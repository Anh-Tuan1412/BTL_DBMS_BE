import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { DataSource, EntityManager } from 'typeorm';
import Stripe from 'stripe';
import {
  Booking,
  Payment,
  Showtime,
  ShowtimeSeat,
  Ticket,
} from '../../database/entities';
import { BookingStatus, PaymentStatus } from '../../common/enums';
import { RedisService } from '../redis/redis.service';
import { StripeGateway } from './stripe.gateway';

@Injectable()
export class StripePaymentsService {
  private readonly logger = new Logger(StripePaymentsService.name);
  constructor(
    private readonly db: DataSource,
    private readonly gateway: StripeGateway,
    private readonly redis: RedisService,
  ) {}

  private async owned(code: string, userId: number) {
    const booking = await this.db
      .getRepository(Booking)
      .findOneBy({ bookingCode: code, userId });
    if (!booking) throw new NotFoundException('Không tìm thấy đơn đặt vé');
    return booking;
  }
  private async locked(manager: EntityManager, initial: Booking) {
    await manager.findOneOrFail(Showtime, {
      where: { id: initial.showtimeId },
      lock: { mode: 'pessimistic_write' },
    });
    return manager.findOneOrFail(Booking, {
      where: { id: initial.id },
      lock: { mode: 'pessimistic_write' },
    });
  }
  private amount(value: number | string) {
    const amount = Number(value);
    if (!Number.isSafeInteger(amount) || amount <= 0)
      throw new BadRequestException('Số tiền VND phải là số nguyên dương');
    return amount;
  }
  async checkout(code: string, userId: number) {
    const initial = await this.owned(code, userId);
    return this.db.transaction('READ COMMITTED', async (manager) => {
      const booking = await this.locked(manager, initial);
      if (
        booking.status !== BookingStatus.PENDING ||
        !booking.holdExpiresAt ||
        new Date(booking.holdExpiresAt).getTime() <= Date.now()
      )
        throw new ConflictException('Đơn không còn trong thời hạn thanh toán');
      const payment = await manager.findOneByOrFail(Payment, {
        bookingId: booking.id,
      });
      const stripe = this.gateway.client();
      if (payment.stripeSessionId) {
        const existing = await stripe.checkout.sessions.retrieve(
          payment.stripeSessionId,
        );
        if (existing.status !== 'open' || !existing.url)
          throw new ConflictException(
            'Phiên thanh toán đã kết thúc. Vui lòng kiểm tra trạng thái đơn',
          );
        return { url: existing.url, sessionId: existing.id };
      }
      const frontend = this.gateway.frontendUrl();
      const session = await stripe.checkout.sessions.create(
        {
          mode: 'payment',
          client_reference_id: booking.bookingCode,
          metadata: { bookingCode: booking.bookingCode },
          payment_intent_data: {
            metadata: { bookingCode: booking.bookingCode },
          },
          line_items: [
            {
              quantity: 1,
              price_data: {
                currency: 'vnd',
                unit_amount: this.amount(booking.totalAmount),
                product_data: { name: `Vé xem phim ${booking.bookingCode}` },
              },
            },
          ],
          success_url: `${frontend}/booking/payment?bookingCode=${encodeURIComponent(code)}&session_id={CHECKOUT_SESSION_ID}`,
          cancel_url: `${frontend}/booking/payment?bookingCode=${encodeURIComponent(code)}&cancelled=1`,
        },
        { idempotencyKey: `checkout-${booking.bookingCode}` },
      );
      if (session.livemode || !session.url)
        throw new BadRequestException(
          'Stripe không trả về phiên thanh toán test',
        );
      await manager.update(Payment, payment.id, {
        stripeSessionId: session.id,
      });
      return { url: session.url, sessionId: session.id };
    });
  }

  async status(code: string, userId: number) {
    const booking = await this.owned(code, userId);
    const payment = await this.db
      .getRepository(Payment)
      .findOneByOrFail({ bookingId: booking.id });
    if (payment.stripeSessionId) await this.reconcile(payment.stripeSessionId);
    const latest = await this.db
      .getRepository(Payment)
      .findOneByOrFail({ id: payment.id });
    if (latest.status === PaymentStatus.REFUND_PENDING && latest.refundId) {
      const refund = await this.gateway
        .client()
        .refunds.retrieve(latest.refundId);
      await this.db.transaction('READ COMMITTED', async (manager) => {
        await this.locked(manager, booking);
        await this.recordRefund(manager, latest, refund);
      });
    }
    return this.db.getRepository(Booking).findOneOrFail({
      where: { id: booking.id },
      relations: { payments: true, tickets: true },
    });
  }

  async webhook(body: Buffer, signature: string) {
    const event = this.gateway.event(body, signature);
    if (event.livemode)
      throw new BadRequestException('Chỉ chấp nhận Stripe Test Mode');
    if (
      [
        'checkout.session.completed',
        'checkout.session.async_payment_succeeded',
      ].includes(event.type)
    ) {
      await this.reconcile((event.data.object as Stripe.Checkout.Session).id);
    }
    return { received: true };
  }

  async reconcile(sessionId: string) {
    // Retrieve from Stripe even for signed events; never trust browser-provided success flags.
    const stripe = this.gateway.client();
    const session = await stripe.checkout.sessions.retrieve(sessionId);
    if (session.livemode || session.payment_status !== 'paid') return;
    const payment = await this.db
      .getRepository(Payment)
      .findOneBy({ stripeSessionId: session.id });
    if (!payment)
      throw new NotFoundException('Không tìm thấy giao dịch Stripe');
    const initial = await this.db
      .getRepository(Booking)
      .findOneByOrFail({ id: payment.bookingId });
    if (
      session.client_reference_id !== initial.bookingCode ||
      session.currency !== 'vnd' ||
      session.amount_total !== this.amount(initial.totalAmount)
    )
      throw new BadRequestException('Thông tin giao dịch Stripe không khớp');
    const intentId =
      typeof session.payment_intent === 'string'
        ? session.payment_intent
        : session.payment_intent?.id;
    if (!intentId) throw new BadRequestException('Thiếu Stripe PaymentIntent');
    const intent = await stripe.paymentIntents.retrieve(intentId);
    if (
      intent.livemode ||
      intent.status !== 'succeeded' ||
      intent.currency !== 'vnd' ||
      intent.amount_received !== session.amount_total
    )
      throw new BadRequestException('Stripe chưa xác nhận đủ tiền');
    await this.db.transaction('READ COMMITTED', async (manager) => {
      const booking = await this.locked(manager, initial);
      const current = await manager.findOneByOrFail(Payment, {
        id: payment.id,
      });
      if ([PaymentStatus.PAID, PaymentStatus.REFUNDED].includes(current.status))
        return;
      const tickets = await manager.find(Ticket, {
        where: { bookingId: booking.id },
      });
      const inventory = await manager.find(ShowtimeSeat, {
        where: { bookingId: booking.id },
      });
      const canIssue =
        booking.status === BookingStatus.PENDING &&
        booking.holdExpiresAt &&
        new Date(booking.holdExpiresAt).getTime() > Date.now() &&
        tickets.length > 0 &&
        tickets.length === inventory.length &&
        inventory.every((s) => s.status === 'PENDING');
      await manager.update(Payment, payment.id, {
        stripePaymentIntentId: intentId,
        transactionCode: intentId,
        paidAt: new Date(),
      });
      if (!canIssue) {
        // Idempotency protects retries when Stripe succeeds but a database commit fails.
        const refund = await stripe.refunds.create(
          { payment_intent: intentId },
          { idempotencyKey: `late-${booking.bookingCode}` },
        );
        await this.recordRefund(manager, payment, refund);
        if (booking.status === BookingStatus.PENDING)
          await manager.update(Booking, booking.id, {
            status: BookingStatus.EXPIRED,
          });
        await manager.update(
          Ticket,
          { bookingId: booking.id, status: 'PENDING' },
          { status: 'EXPIRED' },
        );
        await manager.update(
          ShowtimeSeat,
          { bookingId: booking.id, status: 'PENDING' },
          { bookingId: null, status: 'AVAILABLE' },
        );
        return;
      }
      await manager.update(Payment, payment.id, { status: PaymentStatus.PAID });
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
    });
    await this.releaseHolds(initial.id);
  }

  private async recordRefund(
    manager: EntityManager,
    payment: Payment,
    refund: Stripe.Refund,
  ) {
    if (refund.status === 'failed' || refund.status === 'canceled')
      throw new ConflictException(
        'Stripe không thể hoàn tiền. Vui lòng thử lại',
      );
    await manager.update(Payment, payment.id, {
      status:
        refund.status === 'succeeded'
          ? PaymentStatus.REFUNDED
          : PaymentStatus.REFUND_PENDING,
      refundId: refund.id,
      refundAmount: refund.amount,
      refundedAt: refund.status === 'succeeded' ? new Date() : null,
    });
  }

  async cancelAndRefund(code: string, userId: number) {
    const initial = await this.owned(code, userId);
    await this.db.transaction('READ COMMITTED', async (manager) => {
      const booking = await this.locked(manager, initial);
      const payment = await manager.findOneByOrFail(Payment, {
        bookingId: booking.id,
      });
      if (
        booking.status === BookingStatus.CANCELLED &&
        [PaymentStatus.REFUNDED, PaymentStatus.REFUND_PENDING].includes(
          payment.status,
        )
      ) {
        if (payment.status === PaymentStatus.REFUND_PENDING && payment.refundId)
          await this.recordRefund(
            manager,
            payment,
            await this.gateway.client().refunds.retrieve(payment.refundId),
          );
        return;
      }
      if (
        booking.status !== BookingStatus.CONFIRMED ||
        payment.status !== PaymentStatus.PAID ||
        !payment.stripePaymentIntentId
      )
        throw new BadRequestException('Đơn chưa được thanh toán qua Stripe');
      const showtime = await manager.findOneByOrFail(Showtime, {
        id: booking.showtimeId,
      });
      if (new Date(showtime.startTime).getTime() - Date.now() < 3600000)
        throw new BadRequestException(
          'Chỉ được hủy trước giờ chiếu ít nhất 60 phút',
        );
      const refund = await this.gateway
        .client()
        .refunds.create(
          { payment_intent: payment.stripePaymentIntentId },
          { idempotencyKey: `cancel-${booking.bookingCode}` },
        );
      await this.recordRefund(manager, payment, refund);
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
    });
    const payment = await this.db
      .getRepository(Payment)
      .findOneByOrFail({ bookingId: initial.id });
    return {
      success: true,
      message:
        payment.status === PaymentStatus.REFUNDED
          ? 'Stripe đã hoàn tiền thành công'
          : 'Stripe đang xử lý hoàn tiền',
      data: {
        bookingCode: code,
        refundAmount: payment.refundAmount,
        refundStatus: payment.status,
        refundId: payment.refundId,
      },
    };
  }

  private async releaseHolds(bookingId: number) {
    try {
      const tickets = await this.db
        .getRepository(Ticket)
        .createQueryBuilder('t')
        .addSelect('t.holdToken')
        .where('t.bookingId = :bookingId', { bookingId })
        .getMany();
      for (const ticket of tickets)
        await this.redis.releaseSeat(
          ticket.showtimeId,
          ticket.seatId,
          ticket.holdToken,
        );
    } catch {
      this.logger.warn(
        `Chưa dọn được khóa Redis cho đơn ${bookingId}; khóa sẽ tự hết hạn`,
      );
    }
  }
}
