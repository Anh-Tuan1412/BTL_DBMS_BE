import { INestApplication, ValidationPipe } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { DataSource } from 'typeorm';
import { createHash, randomUUID } from 'node:crypto';
import * as bcrypt from 'bcrypt';
import { AppModule } from '../src/app.module';
import { EmailService } from '../src/modules/auth/email.service';
import { RedisService } from '../src/modules/redis/redis.service';
import { ShowtimesService } from '../src/modules/showtimes/showtimes.service';
import { BookingsService } from '../src/modules/bookings/bookings.service';
import {
  Booking,
  Cinema,
  CinemaRoom,
  Genre,
  Movie,
  Payment,
  Seat,
  SeatTypeEntity,
  Showtime,
  ShowtimeSeat,
  Ticket,
  User,
} from '../src/database/entities';
import { MovieStatus, UserRole } from '../src/common/enums';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

process.env.ALLOW_MOCK_PAYMENTS = 'true';

describe('Real catalog, seat administration and auth integration', () => {
  let app: INestApplication;
  let db: DataSource;
  let redis: RedisService;
  let cinema: Cinema;
  let room: CinemaRoom;
  let layoutRoom: CinemaRoom;
  let movie: Movie;
  let genre: Genre;
  let showtime: Showtime;
  let seat: Seat;
  let layoutSeat: Seat;
  let otherSeat: Seat;
  let admin: User;
  let customer: User;
  let adminToken: string;
  let customerToken: string;
  let registeredId: number | undefined;
  let previousSession: string;
  const generatedRooms: number[] = [];
  const prefix = `contract-${randomUUID()}`;
  const email = `${prefix}@example.com`;
  const password = 'Integration@123';
  const sent: { email: string; code: string; purpose: string }[] = [];
  const http = () => request(app.getHttpServer());
  const auth = (token = adminToken) => ({ Authorization: `Bearer ${token}` });
  const otpKey = (purpose: string) =>
    `auth:otp:${purpose}:${createHash('sha256').update(email).digest('hex')}`;

  beforeAll(async () => {
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(EmailService)
      .useValue({
        delivery: () => 'console',
        sendCode: async (email: string, code: string, purpose: string) => {
          sent.push({ email, code, purpose });
        },
      })
      .compile();
    app = module.createNestApplication({ rawBody: true });
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        forbidNonWhitelisted: true,
        transform: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    db = app.get(DataSource);
    redis = app.get(RedisService);
    const hash = await bcrypt.hash(password, 4);
    admin = await db.getRepository(User).save({
      email: `admin-${email}`,
      fullName: prefix,
      password: hash,
      role: UserRole.ADMIN,
      status: 'ACTIVE',
    });
    customer = await db.getRepository(User).save({
      email: `customer-${email}`,
      fullName: prefix,
      password: hash,
      role: UserRole.CUSTOMER,
      status: 'ACTIVE',
    });
    for (const user of [admin, customer]) {
      const result = await http()
        .post('/api/auth/login')
        .send({ email: user.email, password })
        .expect(200);
      if (user.id === admin.id) adminToken = result.body.data.accessToken;
      else customerToken = result.body.data.accessToken;
    }
    genre = await db.getRepository(Genre).save({ name: prefix });
    cinema = await db.getRepository(Cinema).save({
      name: prefix,
      address: 'Integration test',
      city: 'Test',
      status: 'ACTIVE',
    });
    room = await db.getRepository(CinemaRoom).save({
      name: prefix,
      cinemaId: cinema.id,
      totalSeats: 1,
      status: 'ACTIVE',
    });
    layoutRoom = await db.getRepository(CinemaRoom).save({
      name: `${prefix}-layout`,
      cinemaId: cinema.id,
      totalSeats: 1,
      status: 'ACTIVE',
    });
    movie = await db.getRepository(Movie).save({
      title: prefix,
      durationMinutes: 90,
      status: MovieStatus.NOW_SHOWING,
      genres: [genre],
    });
    const type = await db
      .getRepository(SeatTypeEntity)
      .findOneByOrFail({ name: 'REGULAR', status: 'ACTIVE' });
    seat = await db.getRepository(Seat).save({
      roomId: room.id,
      row: 'A',
      column: 1,
      seatNumber: 'A1',
      seatTypeId: type.id,
      status: 'AVAILABLE',
    });
    layoutSeat = await db.getRepository(Seat).save({
      roomId: layoutRoom.id,
      row: 'A',
      column: 1,
      seatNumber: 'A1',
      seatTypeId: type.id,
      status: 'AVAILABLE',
    });
    otherSeat = await db.getRepository(Seat).save({
      roomId: layoutRoom.id,
      row: 'C',
      column: 3,
      seatNumber: 'C3',
      seatTypeId: type.id,
      status: 'AVAILABLE',
    });
    await db.getRepository(CinemaRoom).update(layoutRoom.id, { totalSeats: 2 });
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(new Date(Date.now() + 2 * 86400000));
    // 00:30 Vietnam belongs to the previous UTC date; public/admin filters must agree.
    const start = new Date(`${day}T00:30:00+07:00`);
    showtime = await app.get(ShowtimesService).create({
      movieId: movie.id,
      roomId: room.id,
      startTime: start.toISOString(),
      endTime: new Date(start.getTime() + 90 * 60000).toISOString(),
      basePrice: 100000,
    });
  }, 30000);

  afterAll(async () => {
    if (db && showtime) {
      await redis
        .getClient()
        .del(`seat_lock:showtime:${showtime.id}:seat:${seat.id}`);
      await db.query(
        'DELETE p FROM payments p JOIN bookings b ON b.booking_id=p.booking_id WHERE b.showtime_id=?',
        [showtime.id],
      );
      await db.getRepository(Ticket).delete({ showtimeId: showtime.id });
      await db.getRepository(ShowtimeSeat).delete({ showtimeId: showtime.id });
      await db.getRepository(Booking).delete({ showtimeId: showtime.id });
      await db.getRepository(Showtime).delete(showtime.id);
    }
    for (const item of [seat, layoutSeat, otherSeat])
      if (item) await db.getRepository(Seat).delete(item.id);
    if (layoutRoom)
      await db.getRepository(Seat).delete({ roomId: layoutRoom.id });
    for (const id of generatedRooms) {
      await db.getRepository(Seat).delete({ roomId: id });
      await db.getRepository(CinemaRoom).delete(id);
    }
    for (const item of [room, layoutRoom])
      if (item) await db.getRepository(CinemaRoom).delete(item.id);
    if (movie) {
      await db.query('DELETE FROM movie_genres WHERE movie_id=?', [movie.id]);
      await db.getRepository(Movie).delete(movie.id);
    }
    if (genre) await db.getRepository(Genre).delete(genre.id);
    if (cinema) await db.getRepository(Cinema).delete(cinema.id);
    for (const id of [admin?.id, customer?.id, registeredId])
      if (id) await db.getRepository(User).delete(id);
    if (redis)
      for (const purpose of ['verify', 'reset'])
        await redis
          .getClient()
          .del(
            otpKey(purpose),
            `${otpKey(purpose)}:cooldown`,
            `${otpKey(purpose)}:attempts`,
          );
    await app?.close();
  });

  it('returns real genres, cinema IDs and showtime IDs for composite filters', async () => {
    const day = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'Asia/Ho_Chi_Minh',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(showtime.startTime);
    const result = await http()
      .get('/api/search/movies')
      .query({
        keyword: prefix,
        genre: genre.name,
        cinemaId: cinema.id,
        date: day,
        minPrice: 90000,
        maxPrice: 110000,
      })
      .expect(200);
    expect(result.body.data.items).toHaveLength(1);
    expect(result.body.data.items[0].id).toBe(movie.id);
    expect(
      result.body.data.items[0].showtimes.map((s: Showtime) => s.id),
    ).toEqual([showtime.id]);
    expect(result.body.data.items[0].showtimes[0].room.cinema.id).toBe(
      cinema.id,
    );
    const genres = await http().get('/api/genres').expect(200);
    expect(genres.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: genre.id, name: genre.name }),
      ]),
    );
    const byDay = await http()
      .get('/api/showtimes')
      .query({ movieId: movie.id, date: day })
      .expect(200);
    expect(byDay.body.data.map((s: Showtime) => s.id)).toContain(showtime.id);
  });

  it('actually filters date, cinema and price and rejects inverted/negative prices', async () => {
    for (const filters of [
      { maxPrice: 1 },
      { date: '2000-01-01' },
      { cinemaId: 2147483647 },
    ]) {
      const result = await http()
        .get('/api/search/movies')
        .query({ keyword: prefix, ...filters })
        .expect(200);
      expect(result.body.data.items).toHaveLength(0);
    }
    await http()
      .get('/api/search/movies')
      .query({ minPrice: 200000, maxPrice: 100000 })
      .expect(400);
    await http().get('/api/search/movies').query({ minPrice: -1 }).expect(400);
  });

  it('edits real seat positions/types before sales, rejects duplicates and protects sale inventory', async () => {
    await http()
      .patch(`/api/seats/${layoutSeat.id}`)
      .set(auth(customerToken))
      .send({ row: 'B' })
      .expect(403);
    await http()
      .patch(`/api/seats/${layoutSeat.id}`)
      .set(auth())
      .send({ row: 'B', column: 2, seatNumber: 'B2', type: 'VIP' })
      .expect(200);
    const saved = await db
      .getRepository(Seat)
      .findOneByOrFail({ id: layoutSeat.id });
    expect(saved.seatNumber).toBe('B2');
    expect(saved.seatType.name).toBe('VIP');
    await http()
      .patch(`/api/seats/${layoutSeat.id}`)
      .set(auth())
      .send({ row: 'C', column: 3, seatNumber: 'C3' })
      .expect(409);
    await http()
      .patch(`/api/seats/${seat.id}`)
      .set(auth())
      .send({ row: 'B' })
      .expect(409);
    await http()
      .patch(`/api/seats/${layoutSeat.id}`)
      .set(auth())
      .send({ column: 0 })
      .expect(400);
  });

  it('keeps room capacity consistent when adding, generating and disabling seats', async () => {
    const added = await http()
      .post('/api/seats')
      .set(auth())
      .send({
        roomId: layoutRoom.id,
        row: 'D',
        column: 4,
        seatNumber: 'D4',
        type: 'REGULAR',
      })
      .expect(201);
    await http()
      .post('/api/seats/generate-grid')
      .set(auth())
      .send({
        roomId: layoutRoom.id,
        rows: ['E'],
        colsPerRow: 2,
        vipRows: ['E'],
      })
      .expect(201);
    const repeated = await http()
      .post('/api/seats/generate-grid')
      .set(auth())
      .send({
        roomId: layoutRoom.id,
        rows: ['E'],
        colsPerRow: 2,
        vipRows: ['E'],
      })
      .expect(201);
    expect(repeated.body.data.created).toBe(0);
    expect(
      (
        await db
          .getRepository(CinemaRoom)
          .findOneByOrFail({ id: layoutRoom.id })
      ).totalSeats,
    ).toBe(5);
    await http()
      .delete(`/api/seats/${added.body.data.id}`)
      .set(auth())
      .expect(200);
    expect(
      (
        await db
          .getRepository(CinemaRoom)
          .findOneByOrFail({ id: layoutRoom.id })
      ).totalSeats,
    ).toBe(4);
  });

  it('creates room seats atomically and preserves seat IDs when renaming an open room', async () => {
    const regular = await db
      .getRepository(SeatTypeEntity)
      .findOneByOrFail({ name: 'REGULAR' });
    const invalidName = `${prefix}-invalid`;
    await http()
      .post('/api/cinemas/rooms')
      .set(auth())
      .send({
        name: invalidName,
        cinemaId: cinema.id,
        totalSeats: 1,
        seatConfigurations: [{ seatTypeId: 2147483647, totalSeats: 1 }],
      })
      .expect(400);
    expect(
      await db.getRepository(CinemaRoom).countBy({ name: invalidName }),
    ).toBe(0);
    const valid = await http()
      .post('/api/cinemas/rooms')
      .set(auth())
      .send({
        name: `${prefix}-generated`,
        cinemaId: cinema.id,
        totalSeats: 2,
        seatConfigurations: [{ seatTypeId: regular.id, totalSeats: 2 }],
      })
      .expect(201);
    generatedRooms.push(valid.body.data.id);
    expect(
      await db.getRepository(Seat).countBy({ roomId: valid.body.data.id }),
    ).toBe(2);
    await http()
      .put(`/api/cinemas/rooms/${room.id}`)
      .set(auth())
      .send({
        name: `${prefix}-renamed`,
        totalSeats: 1,
        seatConfigurations: [{ seatTypeId: regular.id, totalSeats: 1 }],
      })
      .expect(200);
    expect(
      (await db.getRepository(Seat).findBy({ roomId: room.id })).map(
        (s) => s.id,
      ),
    ).toEqual([seat.id]);
    await http()
      .put(`/api/cinemas/rooms/${room.id}`)
      .set(auth())
      .send({
        totalSeats: 2,
        seatConfigurations: [{ seatTypeId: regular.id, totalSeats: 2 }],
      })
      .expect(409);
    await http().delete(`/api/seats/${seat.id}`).set(auth()).expect(409);
    await http().delete(`/api/movies/${movie.id}`).set(auth()).expect(409);
  });

  it('requires a real one-time verification code and never accepts a self-assigned admin role', async () => {
    await http()
      .post('/api/auth/register')
      .send({ email, fullName: prefix, password, role: 'ADMIN' })
      .expect(400);
    const registered = await http()
      .post('/api/auth/register')
      .send({ email, fullName: prefix, password })
      .expect(201);
    registeredId = registered.body.data.user.id;
    expect(registered.body.data.user.role).toBe('CUSTOMER');
    expect(registered.body.data.accessToken).toBeUndefined();
    await http().post('/api/auth/login').send({ email, password }).expect(401);
    await http().post('/api/auth/verify-email').send({ email }).expect(400);
    await http()
      .post('/api/auth/verify-email')
      .send({ email, otp: '000000' })
      .expect(400);
    const code = sent.find(
      (s) => s.email === email && s.purpose === 'verify',
    )!.code;
    expect(await redis.getClient().ttl(otpKey('verify'))).toBeGreaterThan(500);
    await http()
      .post('/api/auth/verify-email')
      .send({ email, otp: code })
      .expect(200);
    await http()
      .post('/api/auth/verify-email')
      .send({ email, otp: code })
      .expect(400);
    const signedIn = await http()
      .post('/api/auth/login')
      .send({ email, password })
      .expect(200);
    previousSession = signedIn.body.data.accessToken;
  });

  it('resets the actual password once, checks the code and rate-limits delivery', async () => {
    await http().post('/api/auth/forgot-password').send({ email }).expect(200);
    await http().post('/api/auth/forgot-password').send({ email }).expect(429);
    await http()
      .put('/api/auth/reset-password')
      .send({ email, otp: '000000', newPassword: 'Changed@123' })
      .expect(400);
    const code = sent.find(
      (s) => s.email === email && s.purpose === 'reset',
    )!.code;
    await http()
      .put('/api/auth/reset-password')
      .send({ email, otp: code, newPassword: 'Changed@123' })
      .expect(200);
    await http().get('/api/users/me').set(auth(previousSession)).expect(401);
    await http().post('/api/auth/login').send({ email, password }).expect(401);
    await http()
      .post('/api/auth/login')
      .send({ email, password: 'Changed@123' })
      .expect(200);
    await http()
      .put('/api/auth/reset-password')
      .send({ email, otp: code, newPassword: 'Another@123' })
      .expect(400);
  });

  it('allows an admin to refund another user booking and exposes daily revenue only to admins', async () => {
    const held = await http()
      .post('/api/bookings/hold-seat')
      .set(auth(customerToken))
      .send({ showtimeId: showtime.id, seatId: seat.id })
      .expect(201);
    const created = await http()
      .post('/api/bookings/create')
      .set(auth(customerToken))
      .send({
        showtimeId: showtime.id,
        seatIds: [seat.id],
        holdTokens: { [seat.id]: held.body.data.holdToken },
      })
      .expect(201);
    const code = created.body.data.bookingCode;
    await http()
      .post('/api/bookings/pay-mock')
      .set(auth(customerToken))
      .send({ bookingCode: code })
      .expect(200);
    await http()
      .get('/api/statistics/daily-revenue')
      .set(auth(customerToken))
      .expect(403);
    const daily = await http()
      .get('/api/statistics/daily-revenue')
      .set(auth())
      .expect(200);
    expect(daily.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          bookingCount: expect.any(Number),
          revenue: expect.any(Number),
          date: expect.stringMatching(/^\d{4}-\d{2}-\d{2}$/),
        }),
      ]),
    );
    await http().get(`/api/tickets/${code}`).set(auth()).expect(200);
    await http()
      .post(`/api/tickets/${code}/cancel`)
      .set(auth())
      .send({})
      .expect(201);
    expect(
      (await db.getRepository(Booking).findOneByOrFail({ bookingCode: code }))
        .status,
    ).toBe('CANCELLED');
    expect(
      (
        await db
          .getRepository(Payment)
          .findOneByOrFail({ bookingId: created.body.data.id })
      ).status,
    ).toBe('REFUNDED');
    await http()
      .post(`/api/tickets/${code}/cancel`)
      .set(auth())
      .send({})
      .expect(201);
    await db
      .getRepository(Payment)
      .update(
        { bookingId: created.body.data.id },
        { stripePaymentIntentId: 'pi_test_already_refunded' },
      );
    await http()
      .post(`/api/tickets/${code}/cancel`)
      .set(auth())
      .send({})
      .expect(201);
  });

  it('cancels an unpaid booking without claiming a refund and releases its actual hold', async () => {
    const held = await http()
      .post('/api/bookings/hold-seat')
      .set(auth(customerToken))
      .send({ showtimeId: showtime.id, seatId: seat.id })
      .expect(201);
    const created = await http()
      .post('/api/bookings/create')
      .set(auth(customerToken))
      .send({
        showtimeId: showtime.id,
        seatIds: [seat.id],
        holdTokens: { [seat.id]: held.body.data.holdToken },
      })
      .expect(201);
    const cancelled = await http()
      .post(`/api/tickets/${created.body.data.bookingCode}/cancel`)
      .set(auth(customerToken))
      .send({})
      .expect(201);
    expect(cancelled.body.data.refundAmount).toBe(0);
    expect(
      (
        await db
          .getRepository(Booking)
          .findOneByOrFail({ id: created.body.data.id })
      ).status,
    ).toBe('CANCELLED');
    expect(await redis.getHold(showtime.id, seat.id)).toBeNull();
  });

  it('expires stale pending bookings and frees MySQL inventory even without a payment request', async () => {
    const held = await http()
      .post('/api/bookings/hold-seat')
      .set(auth(customerToken))
      .send({ showtimeId: showtime.id, seatId: seat.id })
      .expect(201);
    const created = await http()
      .post('/api/bookings/create')
      .set(auth(customerToken))
      .send({
        showtimeId: showtime.id,
        seatIds: [seat.id],
        holdTokens: { [seat.id]: held.body.data.holdToken },
      })
      .expect(201);
    await db.getRepository(Booking).update(created.body.data.id, {
      holdExpiresAt: new Date(Date.now() - 1000),
    });
    await app.get(BookingsService).expirePendingBookings();
    expect(
      (
        await db
          .getRepository(Booking)
          .findOneByOrFail({ id: created.body.data.id })
      ).status,
    ).toBe('EXPIRED');
    expect(
      (
        await db
          .getRepository(ShowtimeSeat)
          .findOneByOrFail({ showtimeId: showtime.id, seatId: seat.id })
      ).status,
    ).toBe('AVAILABLE');
    expect(await redis.getHold(showtime.id, seat.id)).toBeNull();
  });

  it('invalidates a code after five wrong attempts and respects Redis expiration', async () => {
    await redis.getClient().del(`${otpKey('reset')}:cooldown`);
    await http().post('/api/auth/forgot-password').send({ email }).expect(200);
    const code = sent.filter((s) => s.purpose === 'reset').at(-1)!.code;
    for (let attempt = 0; attempt < 5; attempt++)
      await http()
        .put('/api/auth/reset-password')
        .send({ email, otp: '000000', newPassword: 'Changed@456' })
        .expect(400);
    await http()
      .put('/api/auth/reset-password')
      .send({ email, otp: code, newPassword: 'Changed@456' })
      .expect(400);
    await redis.getClient().del(`${otpKey('reset')}:cooldown`);
    await http().post('/api/auth/forgot-password').send({ email }).expect(200);
    const expiring = sent.filter((s) => s.purpose === 'reset').at(-1)!.code;
    await redis.getClient().pexpire(otpKey('reset'), 1);
    await new Promise((resolve) => setTimeout(resolve, 10));
    await http()
      .put('/api/auth/reset-password')
      .send({ email, otp: expiring, newPassword: 'Changed@456' })
      .expect(400);
  });
});
