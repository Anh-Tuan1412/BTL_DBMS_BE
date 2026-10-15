import {
  Injectable,
  NotFoundException,
  ServiceUnavailableException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { Seat } from '../../database/entities/seat.entity';
import { Showtime } from '../../database/entities/showtime.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { RedisService } from '../redis/redis.service';
import { CreateSeatDto, GenerateSeatsForRoomDto } from './dto/seat.dto';

@Injectable()
export class SeatsService {
  constructor(
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    private readonly redisService: RedisService,
  ) {}

  // =========================================================================
  // TODO: Đặng Minh Quang - Hiện thực UC3: Quản lý ghế
  // =========================================================================

  async findByRoom(roomId: number) {
    // TODO: Viết logic lấy danh sách ghế theo phòng chiếu
    return {
      message: `TODO: Quang viết logic lấy danh sách ghế phòng ID ${roomId}`,
      roomId,
      data: [],
    };
  }

  async createSeat(dto: CreateSeatDto) {
    // TODO: Viết logic tạo một ghế mới
    return {
      message: 'TODO: Quang viết logic tạo ghế lẻ',
      payload: dto,
    };
  }

  async generateSeatsGrid(dto: GenerateSeatsForRoomDto) {
    // TODO: Viết logic tự động tạo lưới ghế theo hàng/cột (VD: Hàng A->F, Cột 1->10)
    return {
      message: 'TODO: Quang viết logic tạo lưới ma trận ghế cho phòng chiếu',
      payload: dto,
    };
  }

  async deleteSeat(id: number) {
    // TODO: Viết logic xóa ghế
    return {
      message: `TODO: Quang viết logic xóa ghế ID ${id}`,
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
