import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, EntityManager } from 'typeorm';
import { Seat } from '../../database/entities/seat.entity';
import { Showtime } from '../../database/entities/showtime.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { CinemaRoom } from '../../database/entities/cinema-room.entity';
import { SeatTypeEntity } from '../../database/entities/seat-type.entity';
import { RedisService } from '../redis/redis.service';
import {
  CreateSeatDto,
  GenerateSeatsForRoomDto,
  UpdateSeatDto,
} from './dto/seat.dto';
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
  ) {}

  private async lockEditableRoom(manager: EntityManager, roomId: number) {
    const room = await manager.findOne(CinemaRoom, {
      where: { id: roomId },
      lock: { mode: 'pessimistic_write' },
    });
    if (!room || room.status !== 'ACTIVE')
      throw new BadRequestException('Phòng không tồn tại hoặc không khả dụng');
    const upcoming = await manager
      .createQueryBuilder(Showtime, 's')
      .where(
        's.roomId = :roomId AND s.status = :status AND s.startTime > :now',
        { roomId, status: 'SCHEDULED', now: new Date() },
      )
      .getCount();
    if (upcoming)
      throw new ConflictException(
        'Phòng đã mở lịch bán vé. Hãy hủy lịch trước khi thay đổi sơ đồ ghế.',
      );
  }

  private async syncCapacity(manager: EntityManager, roomId: number) {
    await manager.query(
      "UPDATE rooms SET total_seats=(SELECT COUNT(*) FROM seats WHERE room_id=? AND status='AVAILABLE') WHERE room_id=?",
      [roomId, roomId],
    );
  }

  findTypes() {
    return this.seatTypeRepository.find({
      where: { status: 'ACTIVE' },
      order: { id: 'ASC' },
    });
  }

  async updateSeat(id: number, dto: UpdateSeatDto) {
    const initial = await this.seatRepository.findOneBy({ id });
    if (!initial) throw new NotFoundException('Không tìm thấy ghế');
    return this.seatRepository.manager.transaction(async (manager) => {
      // Showtime creation also locks the room. Do not change an inventory layout
      // after it has been offered for sale, including seats held only in Redis.
      await manager.findOneOrFail(CinemaRoom, {
        where: { id: initial.roomId },
        lock: { mode: 'pessimistic_write' },
      });
      const upcoming = await manager
        .createQueryBuilder(Showtime, 's')
        .where(
          's.roomId = :roomId AND s.status = :status AND s.startTime > :now',
          { roomId: initial.roomId, status: 'SCHEDULED', now: new Date() },
        )
        .getCount();
      if (upcoming)
        throw new ConflictException(
          'Phòng đã có suất chiếu mở bán. Hãy hủy lịch trước khi chỉnh sửa sơ đồ ghế.',
        );
      if (await manager.count(Ticket, { where: { seatId: id } })) {
        throw new ConflictException(
          'Ghế đã có lịch sử vé. Không thể đổi vị trí hoặc loại ghế.',
        );
      }
      const seat = await manager.findOneByOrFail(Seat, { id });
      const row = dto.row ?? seat.row;
      const column = dto.column ?? seat.column;
      const label =
        dto.seatNumber ??
        (dto.row !== undefined || dto.column !== undefined
          ? `${row}${column}`
          : seat.seatNumber);
      const conflict = await manager
        .createQueryBuilder(Seat, 'seat')
        .where(
          'seat.roomId = :roomId AND seat.id <> :id AND ((seat.row = :row AND seat.column = :column) OR seat.seatNumber = :label)',
          { roomId: seat.roomId, id, row, column, label },
        )
        .getCount();
      if (conflict)
        throw new ConflictException('Vị trí hoặc mã ghế đã tồn tại');
      if (dto.type) {
        const type = await manager.findOneBy(SeatTypeEntity, {
          name: dto.type,
          status: 'ACTIVE',
        });
        if (!type) throw new BadRequestException('Loại ghế không khả dụng');
        seat.seatTypeId = type.id;
        seat.seatType = type;
      }
      Object.assign(seat, { row, column, seatNumber: label });
      await manager.save(Seat, seat);
      return manager.findOneOrFail(Seat, { where: { id } });
    });
  }

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
    if (!room)
      throw new NotFoundException(`Không tìm thấy phòng chiếu ID ${roomId}`);

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
    return this.seatRepository.manager.transaction(async (manager) => {
      await this.lockEditableRoom(manager, dto.roomId);
      const seatRepo = manager.getRepository(Seat);
      const roomRepo = manager.getRepository(CinemaRoom);
      const typeRepo = manager.getRepository(SeatTypeEntity);

      // 1. Kiểm tra phòng hợp lệ
      const room = await roomRepo.findOneBy({ id: dto.roomId });
      if (!room || room.status !== 'ACTIVE')
        throw new BadRequestException(
          `Phòng chiếu ID ${dto.roomId} không tồn tại hoặc không khả dụng`,
        );

      // 2. Kiểm tra trùng vị trí (unique constraint: roomId + row + column)
      const existing = await seatRepo.findOne({
        where: { roomId: dto.roomId, row: dto.row, column: dto.column },
      });
      if (existing)
        throw new ConflictException(
          `Vị trí ghế ${dto.row}${dto.column} đã tồn tại trong phòng này`,
        );

      // 3. Tìm SeatTypeEntity khớp với tên loại ghế
      const seatType = await typeRepo.findOne({
        where: { name: dto.type, status: 'ACTIVE' },
      });
      if (!seatType)
        throw new BadRequestException(
          `Loại ghế '${dto.type}' không tồn tại hoặc chưa được kích hoạt`,
        );

      // 4. Tạo và lưu ghế mới
      const seat = seatRepo.create({
        roomId: dto.roomId,
        row: dto.row,
        column: dto.column,
        seatNumber: dto.seatNumber,
        seatTypeId: seatType.id,
        status: 'AVAILABLE',
      });
      const saved = await seatRepo.save(seat);

      await this.syncCapacity(manager, dto.roomId);
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
    });
  }

  /**
   * UC3 — Tự động sinh ma trận ghế cho một phòng chiếu.
   * Ví dụ: rows=['A','B','C','D','E','F'], colsPerRow=10, vipRows=['E','F']
   * → Tạo 60 ghế: A1..A10 (REGULAR), ..., E1..E10 (VIP), F1..F10 (VIP)
   *
   * Dùng INSERT IGNORE để bỏ qua ghế đã tồn tại (idempotent).
   */
  async generateSeatsGrid(dto: GenerateSeatsForRoomDto) {
    return this.seatRepository.manager.transaction(async (manager) => {
      await this.lockEditableRoom(manager, dto.roomId);
      const seatRepo = manager.getRepository(Seat);
      const roomRepo = manager.getRepository(CinemaRoom);
      const typeRepo = manager.getRepository(SeatTypeEntity);

      // 1. Kiểm tra phòng
      const room = await roomRepo.findOneBy({ id: dto.roomId });
      if (!room || room.status !== 'ACTIVE')
        throw new BadRequestException(
          `Phòng chiếu ID ${dto.roomId} không tồn tại hoặc không khả dụng`,
        );

      // 2. Lấy seat type IDs cho REGULAR và VIP
      const [regularType, vipType] = await Promise.all([
        typeRepo.findOne({
          where: { name: SeatType.REGULAR, status: 'ACTIVE' },
        }),
        typeRepo.findOne({
          where: { name: SeatType.VIP, status: 'ACTIVE' },
        }),
      ]);
      if (!regularType)
        throw new BadRequestException(
          `Loại ghế '${SeatType.REGULAR}' chưa được tạo trong hệ thống`,
        );
      if (!vipType)
        throw new BadRequestException(
          `Loại ghế '${SeatType.VIP}' chưa được tạo trong hệ thống`,
        );

      const vipRowSet = new Set(
        (dto.vipRows ?? []).map((r) => r.toUpperCase()),
      );

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
      const result = await seatRepo.query(
        `INSERT IGNORE INTO seats (room_id, seat_row, seat_number, seat_label, seat_type_id)
       VALUES ${placeholders.join(', ')}`,
        params,
      );

      const created: number = result.affectedRows ?? 0;
      const skipped = placeholders.length - created;

      await this.syncCapacity(manager, dto.roomId);
      return {
        message: 'Tạo ma trận ghế thành công',
        roomId: dto.roomId,
        roomName: room.name,
        totalAttempted: placeholders.length,
        created,
        skipped,
      };
    });
  }

  /**
   * UC3 — Vô hiệu hóa (soft-delete) một ghế.
   * Không xóa cứng để bảo toàn lịch sử booking.
   * Từ chối nếu ghế có vé PENDING hoặc VALID đang hoạt động.
   */
  async deleteSeat(id: number) {
    const initial = await this.seatRepository.findOneBy({ id });
    if (!initial) throw new NotFoundException('Không tìm thấy ghế');
    return this.seatRepository.manager.transaction(async (manager) => {
      await this.lockEditableRoom(manager, initial.roomId);
      const seat = await manager.findOneByOrFail(Seat, { id });
      if (
        await manager.count(Ticket, {
          where: [
            { seatId: id, status: 'PENDING' },
            { seatId: id, status: 'VALID' },
          ],
        })
      ) {
        throw new ConflictException(
          'Ghế đang có vé hoạt động, không thể vô hiệu hóa',
        );
      }
      await manager.update(Seat, id, { status: 'INACTIVE' });
      await this.syncCapacity(manager, seat.roomId);
      return {
        message: 'Đã vô hiệu hóa ghế',
        seatId: id,
        newStatus: 'INACTIVE',
      };
    });
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
