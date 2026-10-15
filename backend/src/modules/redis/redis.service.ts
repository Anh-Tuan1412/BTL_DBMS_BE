import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';
import { randomUUID } from 'node:crypto';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private readonly configService: ConfigService) {}

  onModuleInit() {
    this.client = new Redis({
      host: this.configService.get<string>('REDIS_HOST', 'localhost'),
      port: Number(this.configService.get('REDIS_PORT', 6379)),
      password: this.configService.get<string>('REDIS_PASSWORD') || undefined,
      lazyConnect: true,
      maxRetriesPerRequest: 1,
      commandTimeout: 3000,
      retryStrategy: (times) =>
        times > 10 ? null : Math.min(times * 1000, 3000),
    });
    this.client.on('error', (error: Error) => this.logger.warn(error.message));
    void this.client
      .connect()
      .catch((error: Error) => this.logger.warn(error.message));
  }

  async onModuleDestroy() {
    this.client?.disconnect();
  }

  getClient(): Redis {
    return this.client;
  }

  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch {
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds) await this.client.set(key, value, 'EX', ttlSeconds);
      else await this.client.set(key, value);
      return true;
    } catch {
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch {
      return false;
    }
  }

  private seatKey(showtimeId: number, seatId: number): string {
    return `seat_lock:showtime:${showtimeId}:seat:${seatId}`;
  }

  // Returning an existing owner's token does not renew the original five-minute TTL.
  async holdSeat(showtimeId: number, seatId: number, userId: number) {
    const token = `${userId}:${randomUUID()}`;
    const result = (await this.client.eval(
      `
      local existing = redis.call('GET', KEYS[1])
      if not existing then
        redis.call('SET', KEYS[1], ARGV[1], 'NX', 'EX', 300)
        return {ARGV[1], 300000}
      end
      if string.sub(existing, 1, string.len(ARGV[2])) == ARGV[2] then
        return {existing, redis.call('PTTL', KEYS[1])}
      end
      return {'', redis.call('PTTL', KEYS[1])}
    `,
      1,
      this.seatKey(showtimeId, seatId),
      token,
      `${userId}:`,
    )) as [string, number];
    return {
      success: Boolean(result[0]) && result[1] > 0,
      holdToken: result[0] || undefined,
      remainingTtl: Math.max(0, Math.floor(result[1] / 1000)),
    };
  }

  // Atomic read of owner and expiry. Redis failures propagate for booking operations.
  async getHold(
    showtimeId: number,
    seatId: number,
  ): Promise<{ token: string; ttlMs: number } | null> {
    const result = (await this.client.eval(
      `
      local token = redis.call('GET', KEYS[1])
      if not token then return {'', -2} end
      return {token, redis.call('PTTL', KEYS[1])}
    `,
      1,
      this.seatKey(showtimeId, seatId),
    )) as [string, number];
    return result[0] && result[1] > 0
      ? { token: result[0], ttlMs: result[1] }
      : null;
  }

  // A stale request can never delete a newer hold, even for the same user.
  async releaseSeat(
    showtimeId: number,
    seatId: number,
    token: string,
  ): Promise<boolean> {
    return (
      Number(
        await this.client.eval(
          `
      local current = redis.call('GET', KEYS[1])
      if not current then return 1 end
      if current ~= ARGV[1] then return 0 end
      return redis.call('DEL', KEYS[1])
    `,
          1,
          this.seatKey(showtimeId, seatId),
          token,
        ),
      ) === 1
    );
  }

  async getHeldSeatsForShowtime(
    showtimeId: number,
  ): Promise<{ seatId: number; userId: number; ttl: number }[]> {
    const held: { seatId: number; userId: number; ttl: number }[] = [];
    const seen = new Set<string>();
    let cursor = '0';
    do {
      const page = await this.client.scan(
        cursor,
        'MATCH',
        `seat_lock:showtime:${showtimeId}:seat:*`,
        'COUNT',
        100,
      );
      cursor = page[0];
      for (const key of page[1]) {
        if (seen.has(key)) continue;
        seen.add(key);
        const seatId = Number(key.split(':').pop());
        const hold = await this.getHold(showtimeId, seatId);
        if (hold)
          held.push({
            seatId,
            userId: Number(hold.token.split(':')[0]),
            ttl: Math.floor(hold.ttlMs / 1000),
          });
      }
    } while (cursor !== '0');
    return held;
  }
}
