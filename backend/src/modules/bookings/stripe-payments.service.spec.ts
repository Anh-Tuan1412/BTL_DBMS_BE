import { ConfigService } from '@nestjs/config';
import { StripeGateway } from './stripe.gateway';
import { StripePaymentsService } from './stripe-payments.service';
import {
  Booking,
  Payment,
  Showtime,
  ShowtimeSeat,
  Ticket,
} from '../../database/entities';
import { BookingStatus, PaymentStatus } from '../../common/enums';

describe('Stripe payment reconciliation', () => {
  let service: StripePaymentsService;
  let manager: any;
  let stripe: any;
  let booking: any;
  let payment: any;
  let session: any;
  let gateway: any;
  beforeEach(() => {
    booking = {
      id: 1,
      bookingCode: 'BK-test',
      showtimeId: 2,
      userId: 7,
      totalAmount: '100000',
      status: BookingStatus.PENDING,
      holdExpiresAt: new Date(Date.now() + 60000),
    };
    payment = {
      id: 3,
      bookingId: 1,
      amount: '100000',
      stripeSessionId: 'cs_test_1',
      status: PaymentStatus.PENDING,
    };
    session = {
      id: 'cs_test_1',
      livemode: false,
      client_reference_id: 'BK-test',
      currency: 'vnd',
      amount_total: 100000,
      payment_status: 'paid',
      payment_intent: 'pi_1',
    };
    stripe = {
      checkout: { sessions: { retrieve: jest.fn(async () => session) } },
      paymentIntents: {
        retrieve: jest.fn().mockResolvedValue({
          livemode: false,
          status: 'succeeded',
          currency: 'vnd',
          amount_received: 100000,
        }),
      },
      refunds: {
        create: jest.fn().mockResolvedValue({
          id: 're_1',
          status: 'succeeded',
          amount: 100000,
        }),
      },
    };
    manager = {
      findOneOrFail: jest.fn(async (entity) =>
        entity === Showtime
          ? { startTime: new Date(Date.now() + 7200000) }
          : booking,
      ),
      findOneByOrFail: jest.fn(async () => payment),
      find: jest.fn(async (entity) =>
        entity === Ticket
          ? [{ seatId: 4 }]
          : entity === ShowtimeSeat
            ? [{ status: 'PENDING' }]
            : [],
      ),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    const repo = (entity: unknown) => ({
      findOneBy: jest.fn(async () => (entity === Booking ? booking : payment)),
      findOneByOrFail: jest.fn(async () =>
        entity === Booking ? booking : payment,
      ),
      createQueryBuilder: () => ({
        addSelect() {
          return this;
        },
        where() {
          return this;
        },
        getMany: async () => [],
      }),
    });
    const db = {
      getRepository: repo,
      transaction: jest.fn(async (_isolation, callback) => callback(manager)),
    };
    gateway = { client: () => stripe };
    service = new StripePaymentsService(db as any, gateway, {
      releaseSeat: jest.fn(),
    } as any);
  });
  it('never confirms a session with the wrong amount', async () => {
    session.amount_total = 1;
    await expect(service.reconcile(session.id)).rejects.toThrow('không khớp');
    expect(manager.update).not.toHaveBeenCalled();
  });
  it('does not confirm unpaid sessions', async () => {
    session.payment_status = 'unpaid';
    await service.reconcile(session.id);
    expect(manager.update).not.toHaveBeenCalled();
  });
  it('confirms valid Stripe payments and inventory together', async () => {
    await service.reconcile(session.id);
    expect(manager.update).toHaveBeenCalledWith(Booking, 1, {
      status: BookingStatus.CONFIRMED,
    });
    expect(manager.update).toHaveBeenCalledWith(
      ShowtimeSeat,
      { bookingId: 1 },
      { status: 'BOOKED' },
    );
  });
  it('refunds a late payment without issuing tickets', async () => {
    booking.holdExpiresAt = new Date(Date.now() - 1000);
    await service.reconcile(session.id);
    expect(stripe.refunds.create).toHaveBeenCalledWith(
      { payment_intent: 'pi_1' },
      { idempotencyKey: 'late-BK-test' },
    );
    expect(manager.update).not.toHaveBeenCalledWith(Booking, 1, {
      status: BookingStatus.CONFIRMED,
    });
  });
  it('does not process an already refunded payment again', async () => {
    payment.status = PaymentStatus.REFUNDED;
    await service.reconcile(session.id);
    expect(stripe.refunds.create).not.toHaveBeenCalled();
    expect(manager.update).not.toHaveBeenCalled();
  });
  it('keeps the booking and inventory if Stripe rejects a refund', async () => {
    booking.status = BookingStatus.CONFIRMED;
    payment.status = PaymentStatus.PAID;
    payment.stripePaymentIntentId = 'pi_1';
    stripe.refunds.create.mockRejectedValue(new Error('Stripe unavailable'));
    await expect(service.cancelAndRefund('BK-test', 7)).rejects.toThrow(
      'Stripe unavailable',
    );
    expect(manager.update).not.toHaveBeenCalled();
  });
  it('rejects live API keys and invalid webhook signatures', () => {
    expect(() =>
      new StripeGateway(
        new ConfigService({ STRIPE_SECRET_KEY: 'sk_live_example' }),
      ).client(),
    ).toThrow('Test Mode');
    const gateway = new StripeGateway(
      new ConfigService({
        STRIPE_SECRET_KEY: 'sk_test_example',
        STRIPE_WEBHOOK_SECRET: 'whsec_example',
      }),
    );
    expect(() => gateway.event(Buffer.from('{}'), 'invalid')).toThrow(
      'không hợp lệ',
    );
  });
  it('accepts correctly signed webhooks and rejects tampered bodies', () => {
    const config = new ConfigService({
      STRIPE_SECRET_KEY: 'sk_test_signature_only',
      STRIPE_WEBHOOK_SECRET: 'whsec_signature_test',
    });
    const gateway = new StripeGateway(config);
    const payload = JSON.stringify({
      id: 'evt_test',
      type: 'checkout.session.completed',
      livemode: false,
      data: { object: { id: 'cs_test_1' } },
    });
    const signature = gateway
      .client()
      .webhooks.generateTestHeaderString({
        payload,
        secret: 'whsec_signature_test',
      });
    expect(gateway.event(Buffer.from(payload), signature).id).toBe('evt_test');
    expect(() => gateway.event(Buffer.from(payload + ' '), signature)).toThrow(
      'không hợp lệ',
    );
  });
});
