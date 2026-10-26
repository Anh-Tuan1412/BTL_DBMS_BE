import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Seat } from '../../database/entities/seat.entity';
import { Showtime } from '../../database/entities/showtime.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { CinemaRoom } from '../../database/entities/cinema-room.entity';
import { SeatTypeEntity } from '../../database/entities/seat-type.entity';
import { RedisService } from '../redis/redis.service';
import { CreateSeatDto, GenerateSeatsForRoomDto } from './dto/seat.dto';
import { SeatType } from '../../common/enums';

@Injectable()
export class SeatsService {
  constructor(
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(CinemaRoom)
    private readonly roomRepository: Repository<CinemaRoom>,
    @InjectRepository(SeatTypeEntity)
    private readonly seatTypeRepository: Repository<SeatTypeEntity>,
    private readonly redisService: RedisService,
  ) { }

  // =========================================================================
  // UC3: Đặng Minh Quang - Quản lý ghế ngồi
  // =========================================================================

  /**
   * UC3 — Lấy danh sách tất cả ghế trong một phòng chiếu.
   * Ghế được sắp xếp theo hàng (A→Z) rồi đến cột (1→n).
   * SeatTypeEntity đã khai báo eager:true nên TypeORM tự JOIN, không cần khai báo thêm.
   */
  async findByRoom(roomId: number) {
    const room = await this.roomRepository.findOneBy({ id: roomId });
    if (!room) throw new NotFoundException(`Không tìm thấy phòng chiếu ID ${roomId}`);

    const seats = await this.seatRepository.find({
      where: { roomId },
      order: { row: 'ASC', column: 'ASC' },
    });

    return {
      message: 'Lấy danh sách ghế thành công',
      roomId,
      roomName: room.name,
      total: seats.length,
      data: seats.map((seat) => ({
        id: seat.id,
        label: seat.seatNumber,
        row: seat.row,
        column: seat.column,
        type: seat.seatType.name,
        priceCoefficient: Number(seat.seatType.priceCoefficient),
        status: seat.status,
      })),
    };
  }

  /**
   * UC3 — Tạo một ghế đơn lẻ vào phòng chiếu.
   * Kiểm tra:
   *  1. Phòng phải tồn tại và đang ACTIVE.
   *  2. Không được trùng vị trí (roomId + row + column).
   *  3. Tìm SeatTypeEntity theo tên enum (REGULAR / VIP / COUPLE).
   */
  async createSeat(dto: CreateSeatDto) {
    // 1. Kiểm tra phòng hợp lệ
    const room = await this.roomRepository.findOneBy({ id: dto.roomId });
    if (!room || room.status !== 'ACTIVE')
      throw new BadRequestException(`Phòng chiếu ID ${dto.roomId} không tồn tại hoặc không khả dụng`);

    // 2. Kiểm tra trùng vị trí (unique constraint: roomId + row + column)
    const existing = await this.seatRepository.findOne({
      where: { roomId: dto.roomId, row: dto.row, column: dto.column },
    });
    if (existing)
      throw new ConflictException(`Vị trí ghế ${dto.row}${dto.column} đã tồn tại trong phòng này`);

    // 3. Tìm SeatTypeEntity khớp với tên loại ghế
    const seatType = await this.seatTypeRepository.findOne({
      where: { name: dto.type, status: 'ACTIVE' },
    });
    if (!seatType)
      throw new BadRequestException(`Loại ghế '${dto.type}' không tồn tại hoặc chưa được kích hoạt`);

    // 4. Tạo và lưu ghế mới
    const seat = this.seatRepository.create({
      roomId: dto.roomId,
      row: dto.row,
      column: dto.column,
      seatNumber: dto.seatNumber,
      seatTypeId: seatType.id,
      status: 'AVAILABLE',
    });
    const saved = await this.seatRepository.save(seat);

    return {
      message: 'Tạo ghế thành công',
      data: {
        id: saved.id,
        label: saved.seatNumber,
        row: saved.row,
        column: saved.column,
        type: seatType.name,
        priceCoefficient: Number(seatType.priceCoefficient),
        status: saved.status,
      },
    };
  }

  /**
   * UC3 — Tự động sinh ma trận ghế cho một phòng chiếu.
   * Ví dụ: rows=['A','B','C','D','E','F'], colsPerRow=10, vipRows=['E','F']
   * → Tạo 60 ghế: A1..A10 (REGULAR), ..., E1..E10 (VIP), F1..F10 (VIP)
   *
   * Dùng INSERT IGNORE để bỏ qua ghế đã tồn tại (idempotent).
   */
  async generateSeatsGrid(dto: GenerateSeatsForRoomDto) {
    // 1. Kiểm tra phòng
    const room = await this.roomRepository.findOneBy({ id: dto.roomId });
    if (!room || room.status !== 'ACTIVE')
      throw new BadRequestException(`Phòng chiếu ID ${dto.roomId} không tồn tại hoặc không khả dụng`);

    // 2. Lấy seat type IDs cho REGULAR và VIP
    const [regularType, vipType] = await Promise.all([
      this.seatTypeRepository.findOne({ where: { name: SeatType.REGULAR, status: 'ACTIVE' } }),
      this.seatTypeRepository.findOne({ where: { name: SeatType.VIP, status: 'ACTIVE' } }),
    ]);
    if (!regularType)
      throw new BadRequestException(`Loại ghế '${SeatType.REGULAR}' chưa được tạo trong hệ thống`);
    if (!vipType)
      throw new BadRequestException(`Loại ghế '${SeatType.VIP}' chưa được tạo trong hệ thống`);

    const vipRowSet = new Set((dto.vipRows ?? []).map((r) => r.toUpperCase()));

    // 3. Tạo danh sách ghế cần INSERT
    const placeholders: string[] = [];
    const params: (string | number)[] = [];

    for (const rawRow of dto.rows) {
      const row = rawRow.toUpperCase();
      const seatTypeId = vipRowSet.has(row) ? vipType.id : regularType.id;

      for (let col = 1; col <= dto.colsPerRow; col++) {
        const label = `${row}${col}`;
        placeholders.push('(?, ?, ?, ?, ?)');
        params.push(dto.roomId, row, col, label, seatTypeId);
      }
    }

    if (!placeholders.length) {
      return { message: 'Không có ghế nào được tạo (rows rỗng)', created: 0 };
    }

    // 4. Bulk INSERT — bỏ qua nếu ghế đã tồn tại (idempotent)
    const result = await this.seatRepository.query(
      `INSERT IGNORE INTO seats (room_id, seat_row, seat_number, seat_label, seat_type_id)
       VALUES ${placeholders.join(', ')}`,
      params,
    );

    const created: number = result.affectedRows ?? 0;
    const skipped = placeholders.length - created;

    return {
      message: 'Tạo ma trận ghế thành công',
      roomId: dto.roomId,
      roomName: room.name,
      totalAttempted: placeholders.length,
      created,
      skipped,
    };
  }

  /**
   * UC3 — Vô hiệu hóa (soft-delete) một ghế.
   * Không xóa cứng để bảo toàn lịch sử booking.
   * Từ chối nếu ghế có vé PENDING hoặc VALID đang hoạt động.
   */
  async deleteSeat(id: number) {
    // 1. Tìm ghế
    const seat = await this.seatRepository.findOneBy({ id });
    if (!seat) throw new NotFoundException(`Không tìm thấy ghế ID ${id}`);

    if (seat.status === 'INACTIVE') {
      return { message: `Ghế ${seat.seatNumber} đã ở trạng thái INACTIVE`, seatId: id };
    }

    // 2. Kiểm tra có vé đang hoạt động không (PENDING hoặc VALID)
    const activeTicket = await this.ticketRepository.findOne({
      where: [
        { seatId: id, status: 'PENDING' },
        { seatId: id, status: 'VALID' },
      ],
    });
    if (activeTicket) {
      throw new ConflictException(
        `Ghế ${seat.seatNumber} đang có vé ${activeTicket.status} (mã: ${activeTicket.ticketCode}). Không thể vô hiệu hóa.`,
      );
    }

    // 3. Soft-delete: chuyển sang INACTIVE
    seat.status = 'INACTIVE';
    await this.seatRepository.save(seat);

    return {
      message: `Ghế ${seat.seatNumber} đã được vô hiệu hóa thành công`,
      seatId: id,
      newStatus: 'INACTIVE',
    };
  }

  // =========================================================================
  // UC6: Xem sơ đồ và trạng thái ghế
  // Kết hợp MySQL (ghế đã đặt) và Redis (ghế đang giữ tạm thời)
  // =========================================================================

  async getSeatMatrixForShowtime(showtimeId: number, currentUserId?: number) {
    const showtime = await this.showtimeRepository.findOneBy({
      id: showtimeId,
    });
    if (!showtime) throw new NotFoundException('Không tìm thấy suất chiếu');
    const seats = await this.seatRepository.find({
      where: { roomId: showtime.roomId },
      order: { row: 'ASC', column: 'ASC' },
    });
    const allocations: {
      seat_id: number;
      seat_status: string;
      user_id: number;
      hold_expires_at: Date | null;
    }[] = await this.seatRepository.query(
      `
      SELECT s.seat_id, s.seat_status, b.user_id, b.hold_expires_at
      FROM showtime_seats s JOIN bookings b ON b.booking_id = s.booking_id
      WHERE s.showtime_id = ? AND (s.seat_status = 'BOOKED' OR
        (s.seat_status = 'PENDING' AND b.hold_expires_at > UTC_TIMESTAMP()))`,
      [showtimeId],
    );
    let held: Awaited<ReturnType<RedisService['getHeldSeatsForShowtime']>>;
    try {
      held = await this.redisService.getHeldSeatsForShowtime(showtimeId);
    } catch {
      throw new ServiceUnavailableException(
        'Redis chưa sẵn sàng để đọc trạng thái giữ ghế',
      );
    }
    const inventory = new Map(allocations.map((seat) => [seat.seat_id, seat]));
    const holds = new Map(held.map((seat) => [seat.seatId, seat]));
    return {
      showtimeId,
      seats: seats.map((seat) => {
        const allocated = inventory.get(seat.id);
        const hold = holds.get(seat.id);
        const status =
          allocated?.seat_status === 'BOOKED'
            ? 'BOOKED'
            : seat.status === 'INACTIVE'
              ? 'INACTIVE'
              : allocated || hold
                ? 'HOLDING'
                : 'AVAILABLE';
        return {
          id: seat.id,
          row: seat.row,
          column: seat.column,
          seatNumber: seat.seatNumber,
          type: seat.seatType.name,
          priceMultiplier: Number(seat.seatType.priceCoefficient),
          status,
          isHeldByMe:
            status === 'HOLDING' &&
            (allocated
              ? allocated.user_id === currentUserId
              : hold?.userId === currentUserId),
          canRelease:
            status === 'HOLDING' &&
            !allocated &&
            hold?.userId === currentUserId,
          remainingTtl:
            status !== 'HOLDING'
              ? 0
              : allocated?.hold_expires_at
                ? Math.max(
                  0,
                  Math.floor(
                    (new Date(allocated.hold_expires_at).getTime() -
                      Date.now()) /
                    1000,
                  ),
                )
                : (hold?.ttl ?? 0),
        };
      }),
    };
  }
}
