import { StripePaymentsService } from './stripe-payments.service';
import {
  Injectable,
  BadRequestException,
  ConflictException,
  NotFoundException,
  Logger,
  OnModuleInit,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  Repository,
  DataSource,
  In,
  EntityManager,
  LessThanOrEqual,
} from 'typeorm';
import { randomUUID } from 'node:crypto';
import {
  Booking,
  Ticket,
  Showtime,
  Seat,
  Payment,
  ShowtimeSeat,
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
  private sweep?: Promise<void>;

  onModuleInit() {
    this.expiryTimer = setInterval(() => {
      if (this.sweep) return;
      this.sweep = this.expirePendingBookings()
        .catch((error) =>
          this.logger.warn(`Không thể dọn booking hết hạn: ${String(error)}`),
        )
        .finally(() => {
          this.sweep = undefined;
        });
    }, 15000);
    this.expiryTimer.unref();
  }

  async onModuleDestroy() {
    if (this.expiryTimer) clearInterval(this.expiryTimer);
    await this.sweep;
  }

  async expirePendingBookings() {
    const expired = await this.bookingRepository.find({
      where: {
        status: BookingStatus.PENDING,
        holdExpiresAt: LessThanOrEqual(new Date()),
      },
      order: { holdExpiresAt: 'ASC' },
      take: 100,
    });
    for (const booking of expired) await this.expireBooking(booking.id);
  }
  constructor(
    private readonly redisService: RedisService,
    private readonly dataSource: DataSource,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
    @InjectRepository(Showtime)
    private readonly showtimeRepository: Repository<Showtime>,
    @InjectRepository(Seat) private readonly seatRepository: Repository<Seat>,
    private readonly stripePayments: StripePaymentsService,
  ) {}

  private async getShowtime(id: number) {
    const showtime = await this.showtimeRepository.findOneBy({ id });
    if (!showtime) throw new NotFoundException('Suất chiếu không tồn tại');
    if (
      showtime.status !== ShowtimeStatus.SCHEDULED ||
      new Date() >= new Date(showtime.startTime)
    ) {
      throw new BadRequestException('Suất chiếu không còn nhận đặt vé');
    }
    return showtime;
  }

  async holdSeat(userId: number, dto: HoldSeatDto) {
    const showtime = await this.getShowtime(dto.showtimeId);
    const seat = await this.seatRepository.findOneBy({
      id: dto.seatId,
      roomId: showtime.roomId,
      status: 'AVAILABLE',
    });
    if (!seat)
      throw new BadRequestException('Ghế không khả dụng trong phòng chiếu này');
    await this.assertInventoryAvailable(
      this.dataSource.manager,
      dto.showtimeId,
      [dto.seatId],
    );
    const result = await this.redisService.holdSeat(
      dto.showtimeId,
      dto.seatId,
      userId,
    );
    if (!result.success) throw new ConflictException('Ghế đã có người giữ');
    return {
      success: true,
      message: 'Giữ ghế thành công',
      data: {
        ...dto,
        seatNumber: seat.seatNumber,
        userId,
        holdToken: result.holdToken,
        expiresInSeconds: result.remainingTtl,
      },
    };
  }

  async releaseSeat(userId: number, dto: ReleaseSeatDto) {
    if (!dto.holdToken.startsWith(`${userId}:`))
      throw new BadRequestException('Token giữ ghế không hợp lệ');
    const allocation = await this.dataSource.manager.findOneBy(ShowtimeSeat, {
      showtimeId: dto.showtimeId,
      seatId: dto.seatId,
    });
    if (allocation && allocation.status !== 'AVAILABLE')
      throw new ConflictException('Ghế đã thuộc đơn đặt vé');
    if (
      !(await this.redisService.releaseSeat(
        dto.showtimeId,
        dto.seatId,
        dto.holdToken,
      ))
    ) {
      throw new BadRequestException('Lượt giữ ghế đã thay đổi');
    }
    return {
      success: true,
      message: 'Hủy giữ ghế thành công',
      data: { showtimeId: dto.showtimeId, seatId: dto.seatId },
    };
  }

  private async assertInventoryAvailable(
    manager: EntityManager,
    showtimeId: number,
    seatIds: number[],
  ) {
    const allocations = await manager.find(ShowtimeSeat, {
      where: { showtimeId, seatId: In(seatIds) },
    });
    for (const allocation of allocations) {
      if (allocation.status === 'AVAILABLE') continue;
      const owner = allocation.bookingId
        ? await manager.findOneBy(Booking, { id: allocation.bookingId })
        : null;
      if (
        allocation.status === 'PENDING' &&
        owner?.status === BookingStatus.PENDING &&
        owner.holdExpiresAt &&
        new Date(owner.holdExpiresAt).getTime() <= Date.now()
      )
        continue;
      throw new ConflictException('Ghế đã thuộc đơn đặt vé khác');
    }
  }

  async createBooking(userId: number, dto: CreateBookingDto) {
    const showtime = await this.getShowtime(dto.showtimeId);
    const seatIds = [...new Set(dto.seatIds)].sort((a, b) => a - b);
    if (!seatIds.length)
      throw new BadRequestException('Phải chọn ít nhất một ghế');
    const seats = await this.seatRepository.find({
      where: { id: In(seatIds), roomId: showtime.roomId, status: 'AVAILABLE' },
    });
    if (seats.length !== seatIds.length)
      throw new BadRequestException('Ghế không hợp lệ trong phòng chiếu');
    const bookingId = await this.dataSource.transaction(
      'READ COMMITTED',
      async (manager) => {
        // All booking transitions lock the showtime first, preventing double sales and lock-order inversions.
        await manager.findOneOrFail(Showtime, {
          where: { id: showtime.id },
          lock: { mode: 'pessimistic_write' },
        });
        await this.assertInventoryAvailable(manager, showtime.id, seatIds);
        const allocations = await manager.find(ShowtimeSeat, {
          where: { showtimeId: showtime.id, seatId: In(seatIds) },
        });
        for (const allocation of allocations) {
          if (allocation.status === 'PENDING' && allocation.bookingId)
            await this.expireLocked(manager, allocation.bookingId);
        }
        let expiresAt = Math.min(
          Date.now() + 300000,
          new Date(showtime.startTime).getTime(),
        );
        for (const seatId of seatIds) {
          const token = dto.holdTokens?.[seatId];
          const hold = await this.redisService.getHold(showtime.id, seatId);
          if (
            typeof token !== 'string' ||
            !token.startsWith(`${userId}:`) ||
            hold?.token !== token
          ) {
            throw new ConflictException(
              `Lượt giữ ghế ${seatId} không hợp lệ hoặc đã hết hạn`,
            );
          }
          expiresAt = Math.min(expiresAt, Date.now() + hold.ttlMs);
        }
        // MySQL DATETIME stores seconds; never extend a Redis hold through rounding.
        const holdExpiresAt = new Date(Math.floor(expiresAt / 1000) * 1000);
        if (holdExpiresAt.getTime() <= Date.now())
          throw new ConflictException('Lượt giữ ghế đã hết hạn');
        const prices = new Map(
          seats.map((seat) => [
            seat.id,
            Math.round(
              Number(showtime.basePrice) *
                Number(seat.seatType.priceCoefficient) *
                100,
            ) / 100,
          ]),
        );
        const booking = await manager.save(
          Booking,
          manager.create(Booking, {
            bookingCode: `BK-${randomUUID()}`,
            userId,
            showtimeId: showtime.id,
            totalAmount: [...prices.values()].reduce(
              (sum, price) => sum + price,
              0,
            ),
            status: BookingStatus.PENDING,
            holdExpiresAt,
          }),
        );
        for (const seatId of seatIds) {
          await manager.save(
            ShowtimeSeat,
            manager.create(ShowtimeSeat, {
              showtimeId: showtime.id,
              seatId,
              roomId: showtime.roomId,
              bookingId: booking.id,
              status: 'PENDING',
            }),
          );
          await manager.save(
            Ticket,
            manager.create(Ticket, {
              ticketCode: `TK-${randomUUID()}`,
              bookingId: booking.id,
              showtimeId: showtime.id,
              seatId,
              holdToken: dto.holdTokens[seatId],
              price: prices.get(seatId),
              status: 'PENDING',
            }),
          );
        }
        await manager.save(
          Payment,
          manager.create(Payment, {
            bookingId: booking.id,
            method: dto.paymentMethod ?? 'STRIPE',
            amount: booking.totalAmount,
            status: PaymentStatus.PENDING,
          }),
        );
        return booking.id;
      },
    );
    return this.findBookingWithDetails(bookingId);
  }

  private async lockBooking(
    manager: EntityManager,
    bookingId: number,
    showtimeId: number,
  ) {
    await manager.findOneOrFail(Showtime, {
      where: { id: showtimeId },
      lock: { mode: 'pessimistic_write' },
    });
    return manager.findOneOrFail(Booking, {
      where: { id: bookingId },
      lock: { mode: 'pessimistic_write' },
    });
  }

  async mockStripePayment(userId: number, dto: MockStripePaymentDto) {
    if (
      process.env.ALLOW_MOCK_PAYMENTS !== 'true' ||
      process.env.NODE_ENV !== 'test'
    )
      throw new BadRequestException(
        'Thanh toán mock đã tắt. Vui lòng thanh toán qua Stripe',
      );
    const initial = await this.bookingRepository.findOneBy({
      bookingCode: dto.bookingCode,
      userId,
    });
    if (!initial) throw new NotFoundException('Không tìm thấy đơn đặt vé');
    const expired = await this.dataSource.transaction(
      'READ COMMITTED',
      async (manager) => {
        const booking = await this.lockBooking(
          manager,
          initial.id,
          initial.showtimeId,
        );
        if (booking.status === BookingStatus.CONFIRMED) return false;
        if (booking.status !== BookingStatus.PENDING)
          throw new BadRequestException('Đơn không còn chờ thanh toán');
        const tickets = await manager
          .getRepository(Ticket)
          .createQueryBuilder('ticket')
          .addSelect('ticket.holdToken')
          .where('ticket.bookingId = :id', { id: booking.id })
          .getMany();
        let valid = Boolean(
          booking.holdExpiresAt &&
          new Date(booking.holdExpiresAt).getTime() > Date.now(),
        );
        for (const ticket of tickets) {
          const hold = await this.redisService.getHold(
            booking.showtimeId,
            ticket.seatId,
          );
          const allocation = await manager.findOneBy(ShowtimeSeat, {
            showtimeId: booking.showtimeId,
            seatId: ticket.seatId,
          });
          valid =
            valid &&
            hold?.token === ticket.holdToken &&
            allocation?.bookingId === booking.id &&
            allocation?.status === 'PENDING';
        }
        if (!valid) {
          await this.expireLocked(manager, booking.id);
          return true;
        }
        await manager.update(Booking, booking.id, {
          status: BookingStatus.CONFIRMED,
        });
        await manager.update(
          Ticket,
          { bookingId: booking.id },
          { status: 'VALID' },
        );
        await manager.update(
          ShowtimeSeat,
          { bookingId: booking.id },
          { status: 'BOOKED' },
        );
        await manager.update(
          Payment,
          { bookingId: booking.id, status: PaymentStatus.PENDING },
          {
            status: PaymentStatus.PAID,
            transactionCode: `mock_${randomUUID()}`,
            paidAt: new Date(),
          },
        );
        return false;
      },
    );
    await this.releaseBookingHolds(initial.id);
    if (expired)
      throw new ConflictException('Lượt giữ ghế đã hết hạn. Vui lòng đặt lại');
    return {
      success: true,
      message: 'Thanh toán mô phỏng thành công',
      data: { booking: await this.findBookingWithDetails(initial.id) },
    };
  }

  async cancelAndRefund(bookingCode: string, userId: number) {
    const initial = await this.bookingRepository.findOneBy({
      bookingCode,
      userId,
    });
    if (!initial) throw new NotFoundException('Không tìm thấy đơn đặt vé');

    if (initial.status === BookingStatus.PENDING) {
      await this.dataSource.transaction('READ COMMITTED', async (manager) => {
        const booking = await this.lockBooking(
          manager,
          initial.id,
          initial.showtimeId,
        );
        if (booking.status !== BookingStatus.PENDING)
          throw new ConflictException(
            'Trạng thái đơn vừa thay đổi. Vui lòng tải lại trước khi hủy.',
          );
        await this.expireLocked(manager, booking.id);
        await manager.update(Booking, booking.id, {
          status: BookingStatus.CANCELLED,
          cancelledAt: new Date(),
        });
        await manager.update(
          Ticket,
          { bookingId: booking.id },
          { status: 'CANCELLED' },
        );
      });
      await this.releaseBookingHolds(initial.id);
      return {
        success: true,
        message: 'Đã hủy đơn chưa thanh toán',
        data: { bookingCode, status: BookingStatus.CANCELLED, refundAmount: 0 },
      };
    }

    const payment = await this.dataSource.getRepository(Payment).findOneBy({
      bookingId: initial.id,
    });

    if (payment?.stripePaymentIntentId) {
      return this.stripePayments.cancelAndRefund(bookingCode, userId);
    }
    if (initial.status === BookingStatus.CANCELLED) {
      return {
        success: true,
        message: 'Đơn đã được hủy',
        data: {
          bookingCode,
          status: BookingStatus.CANCELLED,
          refundAmount: Number(payment?.refundAmount || 0),
        },
      };
    }
    await this.dataSource.transaction('READ COMMITTED', async (manager) => {
      const booking = await this.lockBooking(
        manager,
        initial.id,
        initial.showtimeId,
      );
      if (booking.status !== BookingStatus.CONFIRMED)
        throw new BadRequestException('Chỉ được hoàn hủy đơn đã thanh toán');
      const showtime = await manager.findOneByOrFail(Showtime, {
        id: booking.showtimeId,
      });
      if (new Date(showtime.startTime).getTime() - Date.now() < 3600000)
        throw new BadRequestException(
          'Chỉ được hủy trước giờ chiếu ít nhất 60 phút',
        );
      await manager.update(Booking, booking.id, {
        status: BookingStatus.CANCELLED,
        cancelledAt: new Date(),
      });
      await manager.update(
        Ticket,
        { bookingId: booking.id },
        { status: 'REFUNDED' },
      );
      await manager.update(
        ShowtimeSeat,
        { bookingId: booking.id },
        { status: 'AVAILABLE', bookingId: null },
      );
      const payments = await manager.find(Payment, {
        where: { bookingId: booking.id, status: PaymentStatus.PAID },
      });
      for (const payment of payments) {
        if (
          !payment.transactionCode?.startsWith('mock_') &&
          !payment.transactionCode?.startsWith('TX-')
        )
          throw new ConflictException(
            'Cần tích hợp Stripe Refund API để hoàn khoản thanh toán thực',
          );
        await manager.update(Payment, payment.id, {
          status: PaymentStatus.REFUNDED,
          refundAmount: payment.amount,
          refundedAt: new Date(),
          refundId: `mock_refund_${randomUUID()}`,
        });
      }
    });
    return {
      success: true,
      message: 'Hủy vé và hoàn tiền mô phỏng thành công',
      data: { bookingCode, refundAmount: initial.totalAmount },
    };
  }

  private async expireLocked(manager: EntityManager, bookingId: number) {
    await manager.update(
      Booking,
      { id: bookingId, status: BookingStatus.PENDING },
      { status: BookingStatus.EXPIRED },
    );
    await manager.update(
      Ticket,
      { bookingId, status: 'PENDING' },
      { status: 'EXPIRED' },
    );
    await manager.update(
      ShowtimeSeat,
      { bookingId, status: 'PENDING' },
      { status: 'AVAILABLE', bookingId: null },
    );
    await manager.update(
      Payment,
      { bookingId, status: PaymentStatus.PENDING },
      { status: PaymentStatus.FAILED },
    );
  }

  async expireBooking(bookingId: number): Promise<boolean> {
    const initial = await this.bookingRepository.findOneBy({ id: bookingId });
    if (!initial) return false;
    const expired = await this.dataSource.transaction(
      'READ COMMITTED',
      async (manager) => {
        const booking = await this.lockBooking(
          manager,
          initial.id,
          initial.showtimeId,
        );
        if (
          booking.status !== BookingStatus.PENDING ||
          !booking.holdExpiresAt ||
          new Date(booking.holdExpiresAt).getTime() > Date.now()
        )
          return false;
        await this.expireLocked(manager, booking.id);
        return true;
      },
    );
    if (expired) await this.releaseBookingHolds(bookingId);
    return expired;
  }

  private async releaseBookingHolds(bookingId: number) {
    // Database commit remains successful even if Redis cleanup needs to wait for TTL.
    try {
      const tickets = await this.dataSource
        .getRepository(Ticket)
        .createQueryBuilder('ticket')
        .addSelect('ticket.holdToken')
        .where('ticket.bookingId = :bookingId', { bookingId })
        .getMany();
      for (const ticket of tickets)
        await this.redisService.releaseSeat(
          ticket.showtimeId,
          ticket.seatId,
          ticket.holdToken,
        );
    } catch (error) {
      this.logger.warn(`Không thể dọn khóa Redis: ${String(error)}`);
    }
  }

  private async findBookingWithDetails(id: number) {
    return this.bookingRepository.findOneOrFail({
      where: { id },
      relations: {
        tickets: { seat: true },
        payments: true,
        showtime: { movie: true, room: true },
      },
    });
  }
}
