import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  OnModuleDestroy,
  OnModuleInit,
  ServiceUnavailableException,
} from '@nestjs/common';
import { randomUUID } from 'node:crypto';
import { DataSource, EntityManager, In } from 'typeorm';
import {
  Booking,
  Ticket,
  Showtime,
  Seat,
  ShowtimeSeat,
  Payment,
} from '../../database/entities';
import {
  BookingStatus,
  PaymentStatus,
  ShowtimeStatus,
} from '../../common/enums';
import { RedisService } from '../redis/redis.service';
import {
  HoldSeatDto,
  ReleaseSeatDto,
  CreateBookingDto,
  MockStripePaymentDto,
} from './dto/booking.dto';

@Injectable()
export class BookingsService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BookingsService.name);
  private expiryTimer?: ReturnType<typeof setInterval>;
  private sweeping = false;

  constructor(
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
  ) {}

  onModuleInit() {
    this.expiryTimer = setInterval(() => {
      void this.expirePendingBookings().catch((error: Error) =>
        this.logger.error(error.message),
      );
    }, 30000);
    this.expiryTimer.unref();
  }

  onModuleDestroy() {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
  }

  // Every seat mutation locks the screening first. This deliberately serializes short
  // transactions per screening and remains safe when Redis restarts or loses its keys.
  private async withShowtime<T>(
    id: number,
    work: (manager: EntityManager, showtime: Showtime) => Promise<T>,
  ) {
    return this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const showtime = await manager.findOne(Showtime, {
        where: { id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!showtime) throw new NotFoundException('Không tìm thấy suất chiếu');
      await this.expireForShowtime(manager, id);
      return work(manager, showtime);
    });
  }

  private async expireForShowtime(manager: EntityManager, showtimeId: number) {
    const parameters = [showtimeId];
    const expired =
      "b.showtime_id = ? AND b.booking_status = 'PENDING' AND b.hold_expires_at <= UTC_TIMESTAMP()";
    const expiredTokens: {
      showtime_id: number;
      seat_id: number;
      hold_token: string;
    }[] = await manager.query(
      `
      SELECT t.showtime_id, t.seat_id, t.hold_token FROM booking_details t
      JOIN bookings b ON b.booking_id = t.booking_id WHERE ${expired} AND t.ticket_status = 'PENDING'`,
      parameters,
    );
    await manager.query(
      `UPDATE showtime_seats s JOIN bookings b ON b.booking_id = s.booking_id
      SET s.booking_id = NULL, s.seat_status = 'AVAILABLE' WHERE ${expired}`,
      parameters,
    );
    await manager.query(
      `UPDATE booking_details t JOIN bookings b ON b.booking_id = t.booking_id
      SET t.ticket_status = 'EXPIRED' WHERE ${expired} AND t.ticket_status = 'PENDING'`,
      parameters,
    );
    await manager.query(
      `UPDATE payments p JOIN bookings b ON b.booking_id = p.booking_id
      SET p.payment_status = 'FAILED' WHERE ${expired} AND p.payment_status = 'PENDING'`,
      parameters,
    );
    await manager.query(
      `UPDATE bookings b SET b.booking_status = 'EXPIRED' WHERE ${expired}`,
      parameters,
    );
    // A multi-seat booking inherits its earliest hold deadline. Release the other
    // original tokens too; they may otherwise have several minutes left in Redis.
    // Expiry is irreversible even if later transaction work fails and rolls back.
    await Promise.all(
      expiredTokens.map(async (ticket) => {
        try {
          await this.redisService.releaseSeat(
            ticket.showtime_id,
            ticket.seat_id,
            ticket.hold_token,
          );
        } catch {
          this.logger.warn(
            `Expired Redis hold will clear by TTL for seat ${ticket.seat_id}`,
          );
        }
      }),
    );
  }

  async expirePendingBookings() {
    if (this.sweeping) return;
    this.sweeping = true;
    try {
      const rows: { showtime_id: number }[] = await this.dataSource.query(`
        SELECT DISTINCT showtime_id FROM bookings
        WHERE booking_status = 'PENDING' AND hold_expires_at <= UTC_TIMESTAMP() LIMIT 100`);
      for (const row of rows)
        await this.withShowtime(row.showtime_id, async () => undefined);
    } finally {
      this.sweeping = false;
    }
  }

  private assertBookable(showtime: Showtime) {
    if (
      showtime.status !== ShowtimeStatus.SCHEDULED ||
      showtime.startTime <= new Date()
    ) {
      throw new ConflictException('Suất chiếu không còn nhận đặt vé');
    }
  }

  private async inventory(
    manager: EntityManager,
    showtime: Showtime,
    seatIds: number[],
  ) {
    const seats = await manager.find(Seat, {
      where: { id: In(seatIds), roomId: showtime.roomId, status: 'AVAILABLE' },
    });
    if (
      seats.length !== seatIds.length ||
      seats.some((seat) => seat.seatType.status !== 'ACTIVE')
    ) {
      throw new BadRequestException(
        'Ghế không hợp lệ, bị vô hiệu hóa hoặc không thuộc phòng chiếu',
      );
    }
    // Supports seats added after a screening was created; never overwrites an owner.
    for (const seat of seats) {
      await manager.query(
        `INSERT INTO showtime_seats (showtime_id, seat_id, room_id)
        VALUES (?, ?, ?) ON DUPLICATE KEY UPDATE seat_id = VALUES(seat_id)`,
        [showtime.id, seat.id, seat.roomId],
      );
    }
    const inventory = await manager.find(ShowtimeSeat, {
      where: { showtimeId: showtime.id, seatId: In(seatIds) },
    });
    if (inventory.some((seat) => seat.status !== 'AVAILABLE'))
      throw new ConflictException('Ghế đã có booking hoặc đã bán');
    return seats;
  }

  async holdSeat(userId: number, dto: HoldSeatDto) {
    return this.withShowtime(dto.showtimeId, async (manager, showtime) => {
      this.assertBookable(showtime);
      await this.inventory(manager, showtime, [dto.seatId]);
      try {
        const result = await this.redisService.holdSeat(
          dto.showtimeId,
          dto.seatId,
          userId,
        );
        if (!result.success)
          throw new ConflictException('Ghế đang được người khác giữ');
        return { ...result, showtimeId: dto.showtimeId, seatId: dto.seatId };
      } catch (error) {
        if (error instanceof ConflictException) throw error;
        throw new ServiceUnavailableException(
          'Redis chưa sẵn sàng, vui lòng thử lại',
        );
      }
    });
  }

  async releaseSeat(userId: number, dto: ReleaseSeatDto) {
    if (!dto.holdToken.startsWith(`${userId}:`))
      throw new ForbiddenException('Token giữ ghế không thuộc người dùng');
    try {
      const released = await this.redisService.releaseSeat(
        dto.showtimeId,
        dto.seatId,
        dto.holdToken,
      );
      if (!released) throw new ConflictException('Token giữ ghế đã thay đổi');
      return { released };
    } catch (error) {
      if (error instanceof ConflictException) throw error;
      throw new ServiceUnavailableException(
        'Redis chưa sẵn sàng, vui lòng thử lại',
      );
    }
  }

  async createBooking(userId: number, dto: CreateBookingDto) {
    const seatIds = [...new Set(dto.seatIds)].sort((a, b) => a - b);
    if (!seatIds.length || seatIds.length !== dto.seatIds.length)
      throw new BadRequestException('Danh sách ghế rỗng hoặc trùng lặp');
    return this.withShowtime(dto.showtimeId, async (manager, showtime) => {
      this.assertBookable(showtime);
      const seats = await this.inventory(manager, showtime, seatIds);
      let expiresAt = showtime.startTime.getTime();
      for (const seatId of seatIds) {
        const token = dto.holdTokens?.[seatId];
        if (typeof token !== 'string' || !token.startsWith(`${userId}:`))
          throw new ForbiddenException('Thiếu token giữ ghế hợp lệ');
        // Use a conservative timestamp taken before the Redis round trip.
        const readStarted = Date.now();
        let hold: Awaited<ReturnType<RedisService['getHold']>>;
        try {
          hold = await this.redisService.getHold(showtime.id, seatId);
        } catch {
          throw new ServiceUnavailableException(
            'Redis chưa sẵn sàng, vui lòng thử lại',
          );
        }
        if (!hold || hold.token !== token)
          throw new ConflictException(
            'Ghế chưa được giữ bởi bạn hoặc đã hết hạn',
          );
        expiresAt = Math.min(expiresAt, readStarted + hold.ttlMs);
      }
      // MySQL DATETIME is second precision; never extend the Redis deadline by rounding up.
      const holdExpiresAt = new Date(Math.floor(expiresAt / 1000) * 1000);
      const prices = seats.map((seat) => ({
        seat,
        price:
          Math.round(
            Number(showtime.basePrice) *
              Number(seat.seatType.priceCoefficient) *
              100,
          ) / 100,
      }));
      const total =
        Math.round(prices.reduce((sum, item) => sum + item.price, 0) * 100) /
        100;
      const booking = await manager.save(
        Booking,
        manager.create(Booking, {
          bookingCode: `BK-${randomUUID()}`,
          userId,
          showtimeId: showtime.id,
          totalAmount: total,
          discountAmount: 0,
          status: BookingStatus.PENDING,
          holdExpiresAt,
        }),
      );
      const tickets = prices.map(({ seat, price }) =>
        manager.create(Ticket, {
          ticketCode: `TK-${randomUUID()}`,
          bookingId: booking.id,
          showtimeId: showtime.id,
          seatId: seat.id,
          price,
          status: 'PENDING',
          holdToken: dto.holdTokens[seat.id],
        }),
      );
      await manager.save(Ticket, tickets);
      for (const seatId of seatIds) {
        const result = await manager.update(
          ShowtimeSeat,
          { showtimeId: showtime.id, seatId, status: 'AVAILABLE' },
          { bookingId: booking.id, status: 'PENDING' },
        );
        if (result.affected !== 1)
          throw new ConflictException('Ghế vừa được người khác đặt');
      }
      await manager.save(
        Payment,
        manager.create(Payment, {
          bookingId: booking.id,
          method: 'STRIPE',
          amount: total,
          currency: 'VND',
          status: PaymentStatus.PENDING,
        }),
      );
      if (holdExpiresAt.getTime() <= Date.now())
        throw new ConflictException('Đã hết thời gian giữ ghế');
      return {
        bookingCode: booking.bookingCode,
        status: booking.status,
        totalAmount: total,
        holdExpiresAt,
        seatIds,
      };
    });
  }

  private async ownedBooking(bookingCode: string, userId: number) {
    const booking = await this.dataSource
      .getRepository(Booking)
      .findOneBy({ bookingCode, userId });
    if (!booking) throw new NotFoundException('Không tìm thấy booking');
    return booking;
  }

  private async tokensForBooking(manager: EntityManager, bookingId: number) {
    return manager
      .createQueryBuilder(Ticket, 'ticket')
      .addSelect('ticket.holdToken')
      .where('ticket.bookingId = :bookingId', { bookingId })
      .getMany();
  }

  private async releaseTokens(tickets: Ticket[]) {
    // Commit MySQL first. Failure here cannot undo a paid/cancelled booking;
    // outstanding Redis keys disappear naturally at their original TTL.
    await Promise.all(
      tickets.map(async (ticket) => {
        try {
          await this.redisService.releaseSeat(
            ticket.showtimeId,
            ticket.seatId,
            ticket.holdToken,
          );
        } catch {
          this.logger.warn(
            `Redis hold will expire naturally for seat ${ticket.seatId}`,
          );
        }
      }),
    );
  }

  async mockStripePayment(userId: number, dto: MockStripePaymentDto) {
    // Existing endpoint is a local mock, not a real Stripe Test Mode integration.
    const original = await this.ownedBooking(dto.bookingCode, userId);
    const outcome = await this.withShowtime(
      original.showtimeId,
      async (manager, showtime) => {
        const booking = (await manager.findOneBy(Booking, {
          id: original.id,
        }))!;
        if (booking.status === BookingStatus.CONFIRMED)
          return { booking, tickets: [] as Ticket[], expired: false };
        if (booking.status === BookingStatus.EXPIRED)
          return { booking, tickets: [] as Ticket[], expired: true };
        if (booking.status !== BookingStatus.PENDING)
          throw new ConflictException('Booking không thể thanh toán');
        this.assertBookable(showtime);
        const tickets = await this.tokensForBooking(manager, booking.id);
        const inventory = await manager.find(ShowtimeSeat, {
          where: {
            bookingId: booking.id,
            showtimeId: showtime.id,
            status: 'PENDING',
          },
        });
        if (!tickets.length || inventory.length !== tickets.length)
          throw new ConflictException('Quyền đặt ghế không hợp lệ');
        const confirmed = await manager.query(
          `UPDATE bookings SET booking_status = 'CONFIRMED'
        WHERE booking_id = ? AND booking_status = 'PENDING' AND hold_expires_at > UTC_TIMESTAMP()
          AND ? > UTC_TIMESTAMP()`,
          [booking.id, showtime.startTime],
        );
        if (confirmed.affectedRows !== 1) {
          await this.expireForShowtime(manager, showtime.id);
          return { booking, tickets: [] as Ticket[], expired: true };
        }
        const payment = await manager.findOneByOrFail(Payment, {
          bookingId: booking.id,
          status: PaymentStatus.PENDING,
        });
        payment.status = PaymentStatus.PAID;
        payment.transactionCode = `mock_${booking.bookingCode}`;
        payment.paidAt = new Date();
        await manager.save(payment);
        await manager.query(
          `INSERT INTO payment_events (stripe_event_id, payment_id, event_type) VALUES (?, ?, ?)`,
          [`mock:${booking.bookingCode}`, payment.id, 'mock.payment_succeeded'],
        );
        await manager.update(
          ShowtimeSeat,
          { bookingId: booking.id },
          { status: 'BOOKED' },
        );
        await manager.update(
          Ticket,
          { bookingId: booking.id },
          { status: 'VALID' },
        );
        booking.status = BookingStatus.CONFIRMED;
        return { booking, tickets, expired: false };
      },
    );
    // Throw after commit so expiring a late payment request is persisted.
    if (outcome.expired)
      throw new ConflictException(
        'Booking đã hết hạn; không ghi nhận thanh toán',
      );
    await this.releaseTokens(outcome.tickets);
    return {
      bookingCode: outcome.booking.bookingCode,
      status: outcome.booking.status,
      paymentStatus: PaymentStatus.PAID,
      mode: 'MOCK',
    };
  }

  async cancelAndRefund(bookingCode: string, userId: number) {
    const original = await this.ownedBooking(bookingCode, userId);
    const outcome = await this.withShowtime(
      original.showtimeId,
      async (manager, showtime) => {
        const booking = (await manager.findOneBy(Booking, {
          id: original.id,
        }))!;
        if (
          [BookingStatus.CANCELLED, BookingStatus.EXPIRED].includes(
            booking.status,
          )
        )
          return { booking, tickets: [] as Ticket[] };
        if (showtime.startTime.getTime() - Date.now() < 60 * 60000)
          throw new ConflictException(
            'Chỉ hủy vé trước suất chiếu ít nhất 60 phút',
          );
        const tickets = await this.tokensForBooking(manager, booking.id);
        if (tickets.some((ticket) => ticket.status === 'USED'))
          throw new ConflictException('Vé đã sử dụng không thể hủy');
        const payment = await manager.findOneBy(Payment, {
          bookingId: booking.id,
          status: PaymentStatus.PAID,
        });
        if (payment) {
          if (!payment.transactionCode?.startsWith('mock_'))
            throw new ConflictException(
              'Cần tích hợp Stripe Refund API để hoàn khoản thanh toán thực',
            );
          payment.status = PaymentStatus.REFUNDED;
          payment.refundAmount = payment.amount;
          payment.refundId = `mock_refund_${booking.bookingCode}`;
          payment.refundedAt = new Date();
          await manager.save(payment);
        } else {
          await manager.update(
            Payment,
            { bookingId: booking.id, status: PaymentStatus.PENDING },
            { status: PaymentStatus.FAILED },
          );
        }
        await manager.update(
          ShowtimeSeat,
          { bookingId: booking.id },
          { bookingId: null, status: 'AVAILABLE' },
        );
        await manager.update(
          Ticket,
          { bookingId: booking.id },
          { status: payment ? 'REFUNDED' : 'CANCELLED' },
        );
        booking.status = BookingStatus.CANCELLED;
        booking.cancelledAt = new Date();
        booking.cancellationReason = 'USER_REQUEST';
        await manager.save(booking);
        return { booking, tickets };
      },
    );
    await this.releaseTokens(outcome.tickets);
    return { bookingCode, status: outcome.booking.status, mode: 'MOCK' };
  }
}
