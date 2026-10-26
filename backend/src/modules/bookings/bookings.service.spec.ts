import { BookingsService } from './bookings.service';
import {
  Booking,
  Payment,
  ShowtimeSeat,
  Ticket,
} from '../../database/entities';
import {
  BookingStatus,
  PaymentStatus,
  ShowtimeStatus,
} from '../../common/enums';

describe('BookingsService hold lifecycle', () => {
  const token = '7:original';
  let service: BookingsService;
  let redis: any;
  let manager: any;
  let bookings: any;
  let source: any;
  let dto: any;
  beforeEach(() => {
    redis = {
      getHold: jest.fn().mockResolvedValue({ token, ttlMs: 90000 }),
      releaseSeat: jest.fn().mockResolvedValue(true),
    };
    manager = {
      findOneOrFail: jest.fn().mockResolvedValue({}),
      find: jest.fn().mockResolvedValue([]),
      create: jest.fn((_entity, value) => value),
      save: jest.fn(async (_entity, value) => ({ id: 10, ...value })),
      update: jest.fn().mockResolvedValue({ affected: 1 }),
    };
    source = {
      manager,
      transaction: jest.fn(async (_level, callback) => callback(manager)),
    };
    bookings = { findOneOrFail: jest.fn().mockResolvedValue({ id: 10 }) };
    service = new BookingsService(
      redis,
      source,
      bookings,
      {
        findOneBy: jest
          .fn()
          .mockResolvedValue({
            id: 1,
            roomId: 2,
            basePrice: 100000,
            status: ShowtimeStatus.SCHEDULED,
            startTime: new Date(Date.now() + 7200000),
          }),
      } as any,
      {
        find: jest
          .fn()
          .mockResolvedValue([
            { id: 5, seatType: { priceCoefficient: '1.5' } },
          ]),
      } as any,
    );
    dto = { showtimeId: 1, seatIds: [5], holdTokens: { '5': token } };
  });

  it('rejects a stale token even when the same user owns the newer hold', async () => {
    redis.getHold.mockResolvedValue({ token: '7:new', ttlMs: 90000 });
    await expect(service.createBooking(7, dto)).rejects.toThrow('không hợp lệ');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('rejects another user’s token', async () => {
    await expect(service.createBooking(8, dto)).rejects.toThrow('không hợp lệ');
    expect(manager.save).not.toHaveBeenCalled();
  });

  it('persists ticket tokens, inventory and payment using the remaining hold lifetime', async () => {
    const started = Date.now();
    await service.createBooking(7, dto);
    const booking = manager.create.mock.calls.find(
      ([entity]: any[]) => entity === Booking,
    )[1];
    expect(booking.holdExpiresAt.getTime()).toBeGreaterThan(started + 88000);
    expect(booking.holdExpiresAt.getTime()).toBeLessThanOrEqual(
      Date.now() + 90000,
    );
    expect(booking.totalAmount).toBe(150000);
    expect(manager.create).toHaveBeenCalledWith(
      Ticket,
      expect.objectContaining({
        showtimeId: 1,
        seatId: 5,
        holdToken: token,
        price: 150000,
      }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      ShowtimeSeat,
      expect.objectContaining({ bookingId: 10, status: 'PENDING' }),
    );
    expect(manager.create).toHaveBeenCalledWith(
      Payment,
      expect.objectContaining({
        amount: 150000,
        status: PaymentStatus.PENDING,
      }),
    );
  });

  it('rejects release of a token belonging to a different user', async () => {
    await expect(
      service.releaseSeat(8, { showtimeId: 1, seatId: 5, holdToken: token }),
    ).rejects.toThrow('không hợp lệ');
    expect(redis.releaseSeat).not.toHaveBeenCalled();
  });

  it('does not expire a booking before its persisted deadline', async () => {
    bookings.findOneBy = jest.fn().mockResolvedValue({ id: 10, showtimeId: 1 });
    manager.findOneOrFail.mockResolvedValue({
      id: 10,
      status: BookingStatus.PENDING,
      holdExpiresAt: new Date(Date.now() + 90000),
    });
    await expect(service.expireBooking(10)).resolves.toBe(false);
    expect(manager.update).not.toHaveBeenCalled();
  });
});
