import {
  Injectable,
  OnModuleInit,
  OnModuleDestroy,
  Logger,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Redis from 'ioredis';

@Injectable()
export class RedisService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RedisService.name);
  private client: Redis;

  constructor(private configService: ConfigService) {}

  onModuleInit() {
    const host = this.configService.get<string>('REDIS_HOST', 'localhost');
    const port = Number(this.configService.get<number>('REDIS_PORT', 6379));
    const password = this.configService.get<string>('REDIS_PASSWORD');

    this.client = new Redis({
      host,
      port,
      password: password || undefined,
      retryStrategy: (times) => {
        // Retry every 3 seconds, up to 10 times
        if (times > 10) {
          this.logger.warn('Redis reconnection limit reached');
          return null;
        }
        return Math.min(times * 1000, 3000);
      },
      lazyConnect: true,
    });

    this.client
      .connect()
      .then(() => {
        this.logger.log(`Connected to Redis at ${host}:${port}`);
      })
      .catch((err) => {
        this.logger.warn(
          `Redis connection error (${err.message}). Make sure Redis is running via Docker ('docker compose up -d').`,
        );
      });
  }

  async onModuleDestroy() {
    if (this.client) {
      await this.client.quit();
    }
  }

  getClient(): Redis {
    return this.client;
  }

  // --- Generic Cache Methods ---
  async get(key: string): Promise<string | null> {
    try {
      return await this.client.get(key);
    } catch (error) {
      this.logger.error(`Error getting key ${key}: ${error.message}`);
      return null;
    }
  }

  async set(key: string, value: string, ttlSeconds?: number): Promise<boolean> {
    try {
      if (ttlSeconds) {
        await this.client.set(key, value, 'EX', ttlSeconds);
      } else {
        await this.client.set(key, value);
      }
      return true;
    } catch (error) {
      this.logger.error(`Error setting key ${key}: ${error.message}`);
      return false;
    }
  }

  async del(key: string): Promise<boolean> {
    try {
      await this.client.del(key);
      return true;
    } catch (error) {
      this.logger.error(`Error deleting key ${key}: ${error.message}`);
      return false;
    }
  }

  // --- UC7: Seat Holding with Redis TTL & Concurrency Control ---
  private getSeatKey(showtimeId: number, seatId: number): string {
    return `seat_lock:showtime:${showtimeId}:seat:${seatId}`;
  }

  /**
   * Giữ ghế tạm thời bằng Redis SET NX EX (Atomic)
   * @param showtimeId ID suất chiếu
   * @param seatId ID ghế
   * @param userId ID người dùng giữ ghế
   * @param ttlSeconds Thời gian giữ ghế (mặc định 300s = 5 phút)
   */
  async holdSeat(
    showtimeId: number,
    seatId: number,
    userId: number,
    ttlSeconds = 300,
  ): Promise<{ success: boolean; message: string; remainingTtl?: number }> {
    try {
      const key = this.getSeatKey(showtimeId, seatId);
      // SET key value EX ttl NX (chỉ set nếu key chưa tồn tại)
      const result = await this.client.set(
        key,
        userId.toString(),
        'EX',
        ttlSeconds,
        'NX',
      );

      if (result === 'OK') {
        return {
          success: true,
          message: `Giữ ghế thành công trong ${ttlSeconds} giây (5 phút)`,
          remainingTtl: ttlSeconds,
        };
      }

      // Nếu đã có người giữ ghế, kiểm tra xem có phải chính user này giữ không
      const currentHolder = await this.client.get(key);
      const remainingTtl = await this.client.ttl(key);

      if (currentHolder === userId.toString()) {
        return {
          success: true,
          message: 'Bạn đang giữ ghế này',
          remainingTtl: remainingTtl > 0 ? remainingTtl : 0,
        };
      }

      return {
        success: false,
        message: 'Ghế này đang được người khác chọn/giữ tạm thời',
        remainingTtl: remainingTtl > 0 ? remainingTtl : 0,
      };
    } catch (error) {
      this.logger.error(
        `Error holding seat ${seatId} for showtime ${showtimeId}: ${error.message}`,
      );
      return { success: false, message: 'Lỗi hệ thống khi giữ ghế' };
    }
  }

  /**
   * Giải phóng ghế tạm thời khi user bỏ chọn hoặc hết hạn/hủy
   */
  async releaseSeat(
    showtimeId: number,
    seatId: number,
    userId: number,
    force = false,
  ): Promise<boolean> {
    try {
      const key = this.getSeatKey(showtimeId, seatId);
      const currentHolder = await this.client.get(key);

      if (!currentHolder) {
        return true;
      }

      if (force || currentHolder === userId.toString()) {
        await this.client.del(key);
        return true;
      }

      return false;
    } catch (error) {
      this.logger.error(`Error releasing seat ${seatId}: ${error.message}`);
      return false;
    }
  }

  /**
   * Lấy danh sách tất cả các ghế đang được giữ tạm thời của một suất chiếu
   */
  async getHeldSeatsForShowtime(
    showtimeId: number,
  ): Promise<{ seatId: number; userId: number; ttl: number }[]> {
    try {
      const pattern = `seat_lock:showtime:${showtimeId}:seat:*`;
      const keys = await this.client.keys(pattern);
      const heldSeats: { seatId: number; userId: number; ttl: number }[] = [];

      for (const key of keys) {
        const parts = key.split(':');
        const seatId = Number(parts[parts.length - 1]);
        const userIdStr = await this.client.get(key);
        const ttl = await this.client.ttl(key);

        if (userIdStr && ttl > 0) {
          heldSeats.push({
            seatId,
            userId: Number(userIdStr),
            ttl,
          });
        }
      }

      return heldSeats;
    } catch (error) {
      this.logger.error(
        `Error getting held seats for showtime ${showtimeId}: ${error.message}`,
      );
      return [];
    }
  }
}
