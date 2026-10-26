import { Test } from '@nestjs/testing';
import { INestApplication, ValidationPipe } from '@nestjs/common';
import { DataSource } from 'typeorm';
import request from 'supertest';
import * as bcrypt from 'bcrypt';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import {
  Booking,
  Cinema,
  CinemaRoom,
  Movie,
  Payment,
  Seat,
  SeatTypeEntity,
  Showtime,
  ShowtimeSeat,
  Ticket,
  User,
} from '../src/database/entities';
import { MovieStatus, ShowtimeStatus, UserRole } from '../src/common/enums';
import { RedisService } from '../src/modules/redis/redis.service';
import { TransformResponseInterceptor } from '../src/common/interceptors/transform-response.interceptor';
import { HttpExceptionFilter } from '../src/common/filters/http-exception.filter';

describe('Booking API integration (real MySQL + Redis)', () => {
  let app: INestApplication;
  let db: DataSource;
  let redis: RedisService;
  let cinema: Cinema;
  let room: CinemaRoom;
  let movie: Movie;
  let showtime: Showtime;
  const seats: Seat[] = [];
  const users: User[] = [];
  const tokens: string[] = [];
  const prefix = `integration-${randomUUID()}`;
  const password = 'Integration@123';
  const api = () => request(app.getHttpServer());
  const post = (path: string, body: object, user = 0) =>
    api()
      .post(`/api/${path}`)
      .set('Authorization', `Bearer ${tokens[user]}`)
      .send(body);
  const hold = async (seatId: number, user = 0) => {
    const response = await post(
      'bookings/hold-seat',
      { showtimeId: showtime.id, seatId },
      user,
    ).expect(201);
    expect(response.body.data.holdToken).toEqual(expect.any(String));
    return response.body.data.holdToken as string;
  };
  const create = (seatId: number, holdToken: string, user = 0) =>
    post(
      'bookings/create',
      {
        showtimeId: showtime.id,
        seatIds: [seatId],
        holdTokens: { [seatId]: holdToken },
      },
      user,
    );
  const allocation = (seatId: number) =>
    db
      .getRepository(ShowtimeSeat)
      .findOneByOrFail({ showtimeId: showtime.id, seatId });

  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    app.setGlobalPrefix('api');
    app.useGlobalPipes(
      new ValidationPipe({
        whitelist: true,
        transform: true,
        forbidNonWhitelisted: true,
        transformOptions: { enableImplicitConversion: true },
      }),
    );
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    app.useGlobalFilters(new HttpExceptionFilter());
    await app.init();
    db = app.get(DataSource);
    redis = app.get(RedisService);
    expect(await redis.getClient().ping()).toBe('PONG');
    const type = await db
      .getRepository(SeatTypeEntity)
      .findOneByOrFail({ status: 'ACTIVE' });
    cinema = await db
      .getRepository(Cinema)
      .save({
        name: prefix,
        address: 'Integration fixture',
        city: 'Test',
        status: 'ACTIVE',
      });
    room = await db
      .getRepository(CinemaRoom)
      .save({
        name: prefix,
        cinemaId: cinema.id,
        totalSeats: 4,
        status: 'ACTIVE',
      });
    movie = await db
      .getRepository(Movie)
      .save({
        title: prefix,
        durationMinutes: 90,
        status: MovieStatus.NOW_SHOWING,
      });
    showtime = await db
      .getRepository(Showtime)
      .save({
        movieId: movie.id,
        roomId: room.id,
        startTime: new Date(Date.now() + 86400000),
        endTime: new Date(Date.now() + 91800000),
        basePrice: 100000,
        status: ShowtimeStatus.SCHEDULED,
      });
    for (let i = 1; i <= 4; i++) {
      const seat = await db
        .getRepository(Seat)
        .save({
          roomId: room.id,
          row: 'A',
          column: i,
          seatNumber: `A${i}`,
          seatTypeId: type.id,
          status: 'AVAILABLE',
        });
      seats.push(seat);
      await db
        .getRepository(ShowtimeSeat)
        .save({
          showtimeId: showtime.id,
          seatId: seat.id,
          roomId: room.id,
          bookingId: null,
          status: 'AVAILABLE',
        });
    }
    for (let i = 0; i < 2; i++) {
      const user = await db
        .getRepository(User)
        .save({
          email: `${prefix}-${i}@example.com`,
          fullName: prefix,
          password: await bcrypt.hash(password, 10),
          role: UserRole.CUSTOMER,
          status: 'ACTIVE',
        });
      users.push(user);
      const response = await api()
        .post('/api/auth/login')
        .send({ email: user.email, password })
        .expect(200);
      tokens.push(response.body.data.accessToken);
      expect(tokens[i]).toEqual(expect.any(String));
    }
  }, 30000);

  afterAll(async () => {
    // Delete only this run's fixture IDs, in foreign-key order. Never flush shared Redis or tables.
    if (db && showtime) {
      for (const seat of seats)
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
    for (const seat of seats) await db.getRepository(Seat).delete(seat.id);
    if (room) await db.getRepository(CinemaRoom).delete(room.id);
    if (movie) await db.getRepository(Movie).delete(movie.id);
    if (cinema) await db.getRepository(Cinema).delete(cinema.id);
    for (const user of users) await db.getRepository(User).delete(user.id);
    await app?.close();
  });

  it('requires authentication and validates booking input', async () => {
    await api()
      .post('/api/bookings/hold-seat')
      .send({ showtimeId: showtime.id, seatId: seats[0].id })
      .expect(401);
    await post('bookings/create', {
      showtimeId: showtime.id,
      seatIds: [],
      holdTokens: {},
    }).expect(400);
  });

  it('holds, books, pays idempotently, displays inventory and refunds', async () => {
    const seatId = seats[0].id;
    const token = await hold(seatId);
    await post(
      'bookings/hold-seat',
      { showtimeId: showtime.id, seatId },
      1,
    ).expect(409);
    const created = await create(seatId, token).expect(201);
    const booking = created.body.data;
    expect(booking.status).toBe('PENDING');
    expect(booking.tickets[0].holdToken).toBeUndefined();
    expect((await allocation(seatId)).status).toBe('PENDING');
    await post(
      'bookings/pay-mock',
      { bookingCode: booking.bookingCode },
      1,
    ).expect(404);
    await post('bookings/pay-mock', {
      bookingCode: booking.bookingCode,
    }).expect(200);
    await post('bookings/pay-mock', {
      bookingCode: booking.bookingCode,
    }).expect(200);
    expect((await allocation(seatId)).status).toBe('BOOKED');
    expect(await redis.getHold(showtime.id, seatId)).toBeNull();
    const payment = await db
      .getRepository(Payment)
      .findOneByOrFail({ bookingId: booking.id });
    expect(payment.status).toBe('SUCCESS');
    expect(Number(payment.amount)).toBe(Number(booking.totalAmount));
    const matrix = await api()
      .get(`/api/seats/matrix/showtime/${showtime.id}`)
      .expect(200);
    expect(
      matrix.body.data.seats.find((s: { id: number }) => s.id === seatId)
        .status,
    ).toBe('BOOKED');
    await post(`tickets/${booking.bookingCode}/cancel`, {}).expect(201);
    expect((await allocation(seatId)).status).toBe('AVAILABLE');
    const refunded = await db
      .getRepository(Payment)
      .findOneByOrFail({ id: payment.id });
    expect(refunded.status).toBe('REFUNDED');
    expect(Number(refunded.refundAmount)).toBe(Number(payment.amount));
  });

  it('allows exactly one winner when two users hold the same seat concurrently', async () => {
    const responses = await Promise.all(
      [0, 1].map((user) =>
        post(
          'bookings/hold-seat',
          { showtimeId: showtime.id, seatId: seats[1].id },
          user,
        ),
      ),
    );
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it('rejects stale tokens and duplicate concurrent bookings', async () => {
    const seatId = seats[2].id;
    const old = await hold(seatId);
    await post('bookings/release-seat', {
      showtimeId: showtime.id,
      seatId,
      holdToken: old,
    }).expect(201);
    const token = await hold(seatId);
    expect(token).not.toBe(old);
    await create(seatId, old).expect(409);
    await post('bookings/release-seat', {
      showtimeId: showtime.id,
      seatId,
      holdToken: old,
    }).expect(400);
    const responses = await Promise.all([
      create(seatId, token),
      create(seatId, token),
    ]);
    expect(responses.map((r) => r.status).sort()).toEqual([201, 409]);
  });

  it('expires a booking without deleting a newer hold and lets the next user book', async () => {
    const seatId = seats[3].id;
    const token = await hold(seatId);
    const created = await create(seatId, token).expect(201);
    const booking = created.body.data;
    await db
      .getRepository(Booking)
      .update(booking.id, { holdExpiresAt: new Date(Date.now() - 10000) });
    await redis
      .getClient()
      .del(`seat_lock:showtime:${showtime.id}:seat:${seatId}`);
    const nextToken = await hold(seatId, 1);
    await post('bookings/pay-mock', {
      bookingCode: booking.bookingCode,
    }).expect(409);
    expect((await redis.getHold(showtime.id, seatId))?.token).toBe(nextToken);
    expect((await allocation(seatId)).status).toBe('AVAILABLE');
    await create(seatId, nextToken, 1).expect(201);
  });
});
