import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, DataSource, In } from 'typeorm';
import {
  Booking,
  Ticket,
  Showtime,
  Seat,
} from '../../database/entities';
import { BookingStatus, PaymentStatus } from '../../common/enums';
import { RedisService } from '../redis/redis.service';
import {
  HoldSeatDto,
  ReleaseSeatDto,
  CreateBookingDto,
  MockStripePaymentDto,
} from './dto/booking.dto';

const HOLD_TTL_SECONDS = 300; // 5 phút

@Injectable()
export class BookingsService {
  private readonly logger = new Logger(BookingsService.name);

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
  // UC7: Giữ chỗ tạm thời qua Redis TTL (5 phút) & Concurrency Control
  // =========================================================================

  /**
   * Giữ 1 ghế tạm thời bằng lệnh SET NX EX trên Redis
   */
  async holdSeat(userId: number, dto: HoldSeatDto) {
    const { showtimeId, seatId } = dto;

    // 1. Kiểm tra suất chiếu hợp lệ
    const showtime = await this.showtimeRepository.findOne({
      where: { id: showtimeId },
    });
    if (!showtime) {
      throw new NotFoundException('Suất chiếu không tồn tại');
    }
    if (new Date() >= new Date(showtime.startTime)) {
      throw new BadRequestException('Suất chiếu đã bắt đầu hoặc đã kết thúc');
    }

    // 2. Kiểm tra ghế có thuộc phòng chiếu của suất chiếu hay không
    const seat = await this.seatRepository.findOne({
      where: { id: seatId, roomId: showtime.roomId },
    });
    if (!seat) {
      throw new BadRequestException('Ghế không tồn tại trong phòng chiếu này');
    }

    // 3. Kiểm tra ghế đã bán thành công trong MySQL chưa (Booking CONFIRMED & Ticket VALID)
    const existingTicket = await this.ticketRepository
      .createQueryBuilder('ticket')
      .innerJoin('ticket.booking', 'booking')
      .where('booking.showtimeId = :showtimeId', { showtimeId })
      .andWhere('ticket.seatId = :seatId', { seatId })
      .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
      .andWhere('ticket.status = :ticketStatus', { ticketStatus: 'VALID' })
      .getOne();

    if (existingTicket) {
      throw new ConflictException('Ghế này đã được đặt mua thành công bởi người khác');
    }

    // 4. Khóa nguyên tử (Atomic Lock) trên Redis bằng SET NX EX
    const result = await this.redisService.holdSeat(
      showtimeId,
      seatId,
      userId,
      HOLD_TTL_SECONDS,
    );

    if (!result.success) {
      throw new ConflictException(result.message);
    }

    return {
      success: true,
      message: result.message,
      data: {
        showtimeId,
        seatId,
        seatNumber: seat.seatNumber,
        userId,
        expiresInSeconds: result.remainingTtl || HOLD_TTL_SECONDS,
      },
    };
  }

  /**
   * Giải phóng ghế khi người dùng chủ động bỏ chọn
   */
  async releaseSeat(userId: number, dto: ReleaseSeatDto) {
    const { showtimeId, seatId } = dto;
    const released = await this.redisService.releaseSeat(
      showtimeId,
      seatId,
      userId,
    );
    if (!released) {
      throw new BadRequestException(
        'Không thể hủy giữ ghế (bạn không sở hữu lượt giữ này hoặc đã hết hạn)',
      );
    }

    return {
      success: true,
      message: 'Hủy giữ ghế thành công',
      data: { showtimeId, seatId },
    };
  }

  // =========================================================================
  // UC8: Tạo Booking (MySQL Transaction Serializable) & Thanh toán Mock Stripe
  // =========================================================================

  /**
   * Tạo đơn Booking và lưu MySQL trong Transaction ACID
   */
  async createBooking(userId: number, dto: CreateBookingDto) {
    const { showtimeId, seatIds, paymentMethod = 'STRIPE' } = dto;
    const uniqueSeatIds = Array.from(new Set(seatIds));

    // 1. Kiểm tra Suất chiếu
    const showtime = await this.showtimeRepository.findOne({
      where: { id: showtimeId },
      relations: {
        movie: true,
        room: true,
      },
    });
    if (!showtime) {
      throw new NotFoundException('Suất chiếu không tồn tại');
    }
    if (new Date() >= new Date(showtime.startTime)) {
      throw new BadRequestException('Suất chiếu đã bắt đầu hoặc đã kết thúc');
    }

    // 2. Kiểm tra danh sách ghế
    const seats = await this.seatRepository.find({
      where: { id: In(uniqueSeatIds), roomId: showtime.roomId },
    });
    if (seats.length !== uniqueSeatIds.length) {
      throw new BadRequestException('Một hoặc nhiều ghế không hợp lệ trong phòng chiếu');
    }

    // 3. Kiểm tra quyền giữ chỗ trên Redis: Phải đúng userId đang giữ tất cả các ghế này
    const redisClient = this.redisService.getClient();
    for (const seatId of uniqueSeatIds) {
      const seatKey = `seat_lock:showtime:${showtimeId}:seat:${seatId}`;
      const holder = await redisClient.get(seatKey);
      if (holder !== userId.toString()) {
        throw new ConflictException(
          `Ghế ID ${seatId} chưa được giữ hoặc đã hết hạn 5 phút. Vui lòng chọn lại ghế!`,
        );
      }
    }

    // 4. Khởi chạy Database Transaction
    const queryRunner = this.dataSource.createQueryRunner();
    await queryRunner.connect();
    await queryRunner.startTransaction();

    try {
      // 4.1 Kiểm tra đối soát trong DB xem có vé nào đã CONFIRMED hay chưa
      const soldTickets = await queryRunner.manager
        .createQueryBuilder(Ticket, 'ticket')
        .innerJoin('ticket.booking', 'booking')
        .where('booking.showtimeId = :showtimeId', { showtimeId })
        .andWhere('ticket.seatId IN (:...seatIds)', { seatIds: uniqueSeatIds })
        .andWhere('booking.status = :status', { status: BookingStatus.CONFIRMED })
        .andWhere('ticket.status = :ticketStatus', { ticketStatus: 'VALID' })
        .getMany();

      if (soldTickets.length > 0) {
        throw new ConflictException('Một trong các ghế đã có người đặt mua trước');
      }

      // 4.2 Tính tổng tiền dựa theo basePrice và priceMultiplier của ghế
      const seatMap = new Map(seats.map((s) => [s.id, s]));
      let calculatedTotal = 0;
      const ticketPayloads: { seatId: number; price: number }[] = [];

      for (const seatId of uniqueSeatIds) {
        const s = seatMap.get(seatId)!;
        const multiplier = Number(s.priceMultiplier) || 1.0;
        const ticketPrice = Number(showtime.basePrice) * multiplier;
        calculatedTotal += ticketPrice;
        ticketPayloads.push({ seatId, price: ticketPrice });
      }

      // 4.3 Tạo bản ghi Booking (PENDING)
      const bookingCode = `BK-${Date.now()}-${Math.floor(1000 + Math.random() * 9000)}`;
      const booking = queryRunner.manager.create(Booking, {
        bookingCode,
        userId,
        showtimeId,
        totalAmount: calculatedTotal,
        status: BookingStatus.PENDING,
        paymentStatus: PaymentStatus.PENDING,
        paymentMethod,
      });
      const savedBooking = await queryRunner.manager.save(Booking, booking);

      // 4.4 Tạo Tickets tương ứng với trạng thái PENDING
      const tickets = ticketPayloads.map((item) =>
        queryRunner.manager.create(Ticket, {
          ticketCode: `TK-${savedBooking.id}-${item.seatId}-${Math.floor(1000 + Math.random() * 9000)}`,
          bookingId: savedBooking.id,
          seatId: item.seatId,
          price: item.price,
          status: 'PENDING',
        }),
      );
      await queryRunner.manager.save(Ticket, tickets);

      await queryRunner.commitTransaction();

      // Đăng ký key theo dõi booking trên Redis với TTL 300 giây
      await redisClient.set(
        `booking_hold:${savedBooking.bookingCode}`,
        JSON.stringify({
          bookingId: savedBooking.id,
          showtimeId,
          seatIds: uniqueSeatIds,
          userId,
        }),
        'EX',
        HOLD_TTL_SECONDS,
      );

      return this.findBookingWithDetails(savedBooking.id);
    } catch (error) {
      await queryRunner.rollbackTransaction();
      throw error;
    } finally {
      await queryRunner.release();
    }
  }

  /**
   * Thanh toán giả lập Mock Stripe (UC8)
   */
  async mockStripePayment(userId: number, dto: MockStripePaymentDto) {
    const { bookingCode, stripeToken = 'tok_visa' } = dto;

    const booking = await this.bookingRepository.findOne({
      where: { bookingCode },
      relations: {
        tickets: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy thông tin đơn đặt vé');
    }
    if (booking.userId !== userId) {
      throw new BadRequestException('Bạn không sở hữu đơn đặt vé này');
    }
    if (booking.status === BookingStatus.CONFIRMED) {
      return {
        success: true,
        message: 'Đơn hàng đã được thanh toán thành công từ trước',
        data: await this.findBookingWithDetails(booking.id),
      };
    }
    if (booking.status === BookingStatus.CANCELLED) {
      throw new BadRequestException('Đơn hàng đã bị hủy hoặc hết hạn thanh toán');
    }

    // Lazy Expiration: Kiểm tra nếu thời gian tạo booking đã quá 5 phút (300,000ms)
    const isExpiredByTime =
      Date.now() - new Date(booking.createdAt).getTime() > HOLD_TTL_SECONDS * 1000;

    const redisClient = this.redisService.getClient();
    const seatIds = booking.tickets.map((t) => t.seatId);

    // Kiểm tra từng ghế xem còn giữ trên Redis không
    let isExpiredByRedis = false;
    for (const seatId of seatIds) {
      const seatKey = `seat_lock:showtime:${booking.showtimeId}:seat:${seatId}`;
      const holder = await redisClient.get(seatKey);
      if (holder !== userId.toString()) {
        isExpiredByRedis = true;
        break;
      }
    }

    if (isExpiredByTime || isExpiredByRedis) {
      await this.expireBooking(booking.id);
      throw new ConflictException(
        'Thời gian giữ chỗ (5 phút) đã hết hạn. Ghế đã được tự động mở khóa. Vui lòng đặt lại!',
      );
    }

    // Thực hiện cập nhật trạng thái đơn sang CONFIRMED và vé sang VALID
    const transactionId = `ch_stripe_mock_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;

    await this.dataSource.transaction(async (manager) => {
      booking.status = BookingStatus.CONFIRMED;
      booking.paymentStatus = PaymentStatus.PAID;
      booking.paymentTransactionId = transactionId;
      await manager.save(Booking, booking);

      await manager.update(
        Ticket,
        { bookingId: booking.id },
        { status: 'VALID' },
      );
    });

    // Giải phóng khóa Redis và xóa booking_hold key
    for (const seatId of seatIds) {
      await this.redisService.releaseSeat(booking.showtimeId, seatId, userId, true);
    }
    await redisClient.del(`booking_hold:${booking.bookingCode}`);

    this.logger.log(`Thanh toán Stripe thành công cho booking [${bookingCode}]`);
    return {
      success: true,
      message: 'Thanh toán qua Stripe thành công! Vé đã được xác nhận.',
      data: {
        booking: await this.findBookingWithDetails(booking.id),
        payment: {
          transactionId,
          stripeToken,
          amount: booking.totalAmount,
          currency: 'VND',
          paidAt: new Date(),
        },
      },
    };
  }

  // =========================================================================
  // Ticket Cancellation & Refund (UC9) & Expiration Logic
  // =========================================================================

  /**
   * Hủy vé và hoàn tiền theo điều kiện (trước giờ chiếu tối thiểu 60 phút)
   */
  async cancelAndRefund(bookingCode: string, userId: number) {
    const booking = await this.bookingRepository.findOne({
      where: { bookingCode, userId },
      relations: {
        showtime: true,
        tickets: true,
      },
    });

    if (!booking) {
      throw new NotFoundException('Không tìm thấy đơn đặt vé hoặc bạn không có quyền hủy');
    }

    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new BadRequestException('Chỉ có thể hoàn hủy đơn đặt vé đã thanh toán thành công');
    }

    const showtimeStart = new Date(booking.showtime.startTime);
    const now = new Date();
    const diffMinutes = (showtimeStart.getTime() - now.getTime()) / (1000 * 60);

    if (diffMinutes < 60) {
      throw new BadRequestException('Chỉ được phép hủy vé trước giờ chiếu ít nhất 60 phút');
    }

    await this.dataSource.transaction(async (manager) => {
      booking.status = BookingStatus.CANCELLED;
      booking.paymentStatus = PaymentStatus.REFUNDED;
      await manager.save(Booking, booking);

      if (booking.tickets && booking.tickets.length > 0) {
        await manager.update(
          Ticket,
          { bookingId: booking.id },
          { status: 'REFUNDED' },
        );
      }
    });

    return {
      success: true,
      message: 'Hủy vé và hoàn tiền thành công',
      data: {
        bookingCode: booking.bookingCode,
        refundAmount: booking.totalAmount,
      },
    };
  }

  /**
   * Tự động hủy đơn booking PENDING khi hết hạn
   */
  async expireBooking(bookingId: number): Promise<boolean> {
    const booking = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: {
        tickets: true,
      },
    });

    if (!booking || booking.status !== BookingStatus.PENDING) {
      return false;
    }

    await this.dataSource.transaction(async (manager) => {
      booking.status = BookingStatus.CANCELLED;
      booking.paymentStatus = PaymentStatus.FAILED;
      await manager.save(Booking, booking);

      if (booking.tickets && booking.tickets.length > 0) {
        await manager.update(
          Ticket,
          { bookingId: booking.id },
          { status: 'CANCELLED' },
        );
      }
    });

    // Giải phóng ghế trên Redis nếu còn tồn tại
    if (booking.tickets && booking.tickets.length > 0) {
      for (const t of booking.tickets) {
        await this.redisService.releaseSeat(
          booking.showtimeId,
          t.seatId,
          booking.userId,
          true,
        );
      }
    }

    const redisClient = this.redisService.getClient();
    await redisClient.del(`booking_hold:${booking.bookingCode}`);
    this.logger.log(`Tự động hủy đơn booking [${booking.bookingCode}] do quá hạn 5 phút.`);
    return true;
  }

  private async findBookingWithDetails(bookingId: number): Promise<Booking> {
    const res = await this.bookingRepository.findOne({
      where: { id: bookingId },
      relations: {
        tickets: {
          seat: true,
        },
        showtime: {
          movie: true,
          room: true,
        },
        user: true,
      },
    });
    return res!;
  }
}