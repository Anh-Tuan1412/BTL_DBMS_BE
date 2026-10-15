import { INestApplication } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule, JwtService } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { Test } from '@nestjs/testing';
import { getRepositoryToken } from '@nestjs/typeorm';
import request from 'supertest';
import { OptionalJwtAuthGuard } from '../../common/guards';
import { TransformResponseInterceptor } from '../../common/interceptors/transform-response.interceptor';
import { Seat, Showtime, Ticket } from '../../database/entities';
import { JwtStrategy } from '../auth/strategies/jwt.strategy';
import { RedisService } from '../redis/redis.service';
import { UsersService } from '../users/users.service';
import { SeatsController } from './seats.controller';
import { SeatsService } from './seats.service';

describe('UC6 seat map with optional JWT', () => {
  let app: INestApplication;
  let jwt: JwtService;
  const secret = 'seat-map-test-secret-only';
  const heldSeats = jest.fn();
  const seats = [1, 2, 3, 4].map((id) => ({
    id,
    row: 'A',
    column: id,
    seatNumber: `A${id}`,
    status: id === 3 || id === 4 ? 'INACTIVE' : 'AVAILABLE',
    seatType: { name: 'REGULAR', priceCoefficient: '1.00' },
  }));

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [
        PassportModule.register({ defaultStrategy: 'jwt' }),
        JwtModule.register({ secret }),
      ],
      controllers: [SeatsController],
      providers: [
        SeatsService,
        OptionalJwtAuthGuard,
        JwtStrategy,
        {
          provide: ConfigService,
          useValue: new ConfigService({ JWT_SECRET: secret }),
        },
        {
          provide: UsersService,
          useValue: { findById: async (id: number) => ({ id }) },
        },
        {
          provide: RedisService,
          useValue: { getHeldSeatsForShowtime: heldSeats },
        },
        {
          provide: getRepositoryToken(Seat),
          useValue: {
            find: async () => seats,
            query: async () => [
              {
                seat_id: 2,
                seat_status: 'PENDING',
                user_id: 7,
                hold_expires_at: new Date(Date.now() + 120000),
              },
              {
                seat_id: 3,
                seat_status: 'BOOKED',
                user_id: 7,
                hold_expires_at: null,
              },
            ],
          },
        },
        {
          provide: getRepositoryToken(Showtime),
          useValue: { findOneBy: async () => ({ id: 1, roomId: 1 }) },
        },
        { provide: getRepositoryToken(Ticket), useValue: {} },
      ],
    }).compile();
    app = moduleRef.createNestApplication();
    app.useGlobalInterceptors(new TransformResponseInterceptor());
    await app.init();
    jwt = moduleRef.get(JwtService);
  });

  beforeEach(() =>
    heldSeats.mockResolvedValue([{ seatId: 1, userId: 7, ttl: 180 }]),
  );
  afterAll(async () => {
    await app.close();
  });

  it('lets guests see statuses without revealing ownership or hold tokens', async () => {
    const response = await request(app.getHttpServer())
      .get('/seats/matrix/showtime/1')
      .expect(200);
    expect(response.headers['cache-control']).toBe('private, no-store');
    expect(
      (response.body.data.seats as { status: string }[]).map(
        (seat) => seat.status,
      ),
    ).toEqual(['HOLDING', 'HOLDING', 'BOOKED', 'INACTIVE']);
    for (const seat of response.body.data.seats) {
      expect(seat.isHeldByMe).toBe(false);
      expect(seat.canRelease).toBe(false);
      expect(seat.holdToken).toBeUndefined();
    }
  });

  it('identifies the owner for Redis holds and pending MySQL bookings', async () => {
    const token = jwt.sign({ sub: 7 });
    const response = await request(app.getHttpServer())
      .get('/seats/matrix/showtime/1')
      .set('Authorization', `Bearer ${token}`)
      .expect(200);
    const [held, pending, booked] = response.body.data.seats;
    expect(held.isHeldByMe).toBe(true);
    expect(held.canRelease).toBe(true);
    expect(pending.isHeldByMe).toBe(true);
    expect(pending.canRelease).toBe(false);
    expect(booked.isHeldByMe).toBe(false);
    expect(booked.remainingTtl).toBe(0);
  });

  it('does not attribute another user’s holds to the signed-in user', async () => {
    const response = await request(app.getHttpServer())
      .get('/seats/matrix/showtime/1')
      .set('Authorization', `Bearer ${jwt.sign({ sub: 8 })}`)
      .expect(200);
    expect(
      (response.body.data.seats as { isHeldByMe: boolean }[]).every(
        (seat) => !seat.isHeldByMe,
      ),
    ).toBe(true);
  });

  it('rejects invalid credentials rather than silently treating them as anonymous', async () => {
    await request(app.getHttpServer())
      .get('/seats/matrix/showtime/1')
      .set('Authorization', 'Bearer invalid-token')
      .expect(401);
  });

  it('rejects expired tokens', async () => {
    await request(app.getHttpServer())
      .get('/seats/matrix/showtime/1')
      .set('Authorization', `Bearer ${jwt.sign({ sub: 7 }, { expiresIn: -1 })}`)
      .expect(401);
  });

  it('does not report seats as available when Redis is unavailable', async () => {
    heldSeats.mockRejectedValueOnce(new Error('Redis offline'));
    await request(app.getHttpServer())
      .get('/seats/matrix/showtime/1')
      .expect(503);
  });
});
