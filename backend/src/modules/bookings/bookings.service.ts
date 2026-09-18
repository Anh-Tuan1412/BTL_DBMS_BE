import { Injectable } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource } from 'typeorm';
import { Booking } from '../../database/entities/booking.entity';
import { Ticket } from '../../database/entities/ticket.entity';
import { Showtime } from '../../database/entities/showtime.entity';
import { Seat } from '../../database/entities/seat.entity';
import { RedisService } from '../redis/redis.service';
import {
  HoldSeatDto,
  ReleaseSeatDto,
  CreateBookingDto,
  MockStripePaymentDto,
} from './dto/booking.dto';

@Injectable()
export class BookingsService {
  constructor(
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Ticket)
    private readonly ticketRepository: Repository<Ticket>,
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    @InjectRepository(Seat)
    private readonly seatRepository: Repository<Seat>,
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
  ) {}

  // =========================================================================
  // TODO: Định - Hiện thực UC7: Giữ ghế tạm thời với Redis TTL (5 phút)
  // Áp dụng Concurrency Control & Atomic Lock (SET NX EX)
  // =========================================================================

  async holdSeat(userId: number, dto: HoldSeatDto) {
    // TODO: Định viết logic:
    // 1. Kiểm tra xem ghế đã được ai mua chưa trong MySQL
    // 2. Gọi redisService.holdSeat() để thực hiện khóa nguyên tử trên Redis với TTL 300s
    return {
      message: 'TODO: Định viết logic giữ ghế với Redis TTL (5 phút)',
      userId,
      showtimeId: dto.showtimeId,
      seatId: dto.seatId,
    };
  }

  async releaseSeat(userId: number, dto: ReleaseSeatDto) {
    // TODO: Định viết logic giải phóng khóa ghế trên Redis khi user hủy chọn
    return {
      message: 'TODO: Định viết logic giải phóng ghế giữ tạm thời',
      userId,
      showtimeId: dto.showtimeId,
      seatId: dto.seatId,
    };
  }

  // =========================================================================
  // TODO: Định - Hiện thực UC8: Đặt vé và Thanh toán (Stripe Test Mode)
  // Sử dụng MySQL Transaction (queryRunner) để đảm bảo tính ACID
  // =========================================================================

  async createBooking(userId: number, dto: CreateBookingDto) {
    // TODO: Định viết logic Transaction đặt vé:
    // const queryRunner = this.dataSource.createQueryRunner();
    // await queryRunner.connect();
    // await queryRunner.startTransaction('SERIALIZABLE');
    // try {
    //   1. Kiểm tra ghế hợp lệ & chưa ai mua
    //   2. Tính tổng tiền
    //   3. Tạo Booking (PENDING)
    //   4. Tạo Tickets tương ứng từng ghế
    //   5. Commit Transaction
    // } catch { Rollback }
    return {
      message: 'TODO: Định viết logic tạo booking với MySQL Transaction',
      userId,
      payload: dto,
    };
  }

  async mockStripePayment(userId: number, dto: MockStripePaymentDto) {
    // TODO: Định viết logic xử lý thanh toán Stripe (Mock):
    // 1. Tìm đơn booking
    // 2. Chuyển trạng thái sang CONFIRMED và PAID
    // 3. Giải phóng lock Redis cho các ghế đã thanh toán thành công
    return {
      message: 'TODO: Định viết logic thanh toán Stripe Test Mode',
      userId,
      bookingCode: dto.bookingCode,
    };
  }
}
