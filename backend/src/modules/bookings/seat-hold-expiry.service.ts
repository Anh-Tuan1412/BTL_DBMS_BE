import {
  Injectable,
  Logger,
  OnApplicationBootstrap,
  OnModuleDestroy,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import Redis from 'ioredis';
import { Booking } from '../../database/entities/booking.entity';
import { BookingStatus } from '../../common/enums';
import { RedisService } from '../redis/redis.service';
import { BookingsService } from './bookings.service';

const SWEEP_INTERVAL_MS = 30_000; // 30 giây chạy quét đối soát 1 lần
const HOLD_TIMEOUT_MS = 300_000;  // 5 phút = 300,000 ms

@Injectable()
export class SeatHoldExpiryService
  implements OnApplicationBootstrap, OnModuleDestroy
{
  private readonly logger = new Logger(SeatHoldExpiryService.name);
  private subscriber?: Redis;
  private timer?: NodeJS.Timeout;
  private sweeping = false;

  constructor(
    private readonly redisService: RedisService,
    private readonly bookingsService: BookingsService,
    @InjectRepository(Booking)
    private readonly bookingRepository: Repository<Booking>,
  ) {}

  async onApplicationBootstrap() {
    await this.subscribeExpiredEvents();
    void this.sweep();
    this.timer = setInterval(() => void this.sweep(), SWEEP_INTERVAL_MS);
    this.timer.unref();
  }

  async onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
    if (this.subscriber) {
      await this.subscriber.quit().catch(() => undefined);
    }
  }

  private async subscribeExpiredEvents() {
    try {
      const client = this.redisService.getClient();
      this.subscriber = client.duplicate();

      this.subscriber.on('error', (err) =>
        this.logger.warn(`Lỗi Redis Subscriber: ${err.message}`),
      );

      this.subscriber.on('pmessage', (_pattern, _channel, key: string) => {
        // Nhận event khi key seat_lock:* hết hạn
        if (key.startsWith('seat_lock:showtime:')) {
          this.logger.log(`Ghế hết hạn giữ chỗ từ Redis: ${key}`);
        }
      });

      await this.subscriber.psubscribe('__keyevent@*__:expired');
      this.logger.log('Đã kích hoạt lắng nghe sự kiện hết hạn ghế từ Redis');
    } catch (err: any) {
      this.logger.warn(
        `Không thể subscribe Redis keyspace (${err.message}). Sweeper sẽ đảm nhận giải phóng ghế mỗi 30s.`,
      );
    }
  }

  /**
   * Quét và hủy các đơn Booking PENDING đã quá 5 phút kể từ lúc tạo
   */
  async sweep() {
    if (this.sweeping) return;
    this.sweeping = true;

    try {
      const timeoutThreshold = new Date(Date.now() - HOLD_TIMEOUT_MS);

      const staleBookings = await this.bookingRepository
        .createQueryBuilder('booking')
        .select(['booking.id', 'booking.bookingCode'])
        .where('booking.status = :status', { status: BookingStatus.PENDING })
        .andWhere('booking.createdAt <= :threshold', { threshold: timeoutThreshold })
        .take(50)
        .getMany();

      if (staleBookings.length > 0) {
        let count = 0;
        for (const b of staleBookings) {
          if (await this.bookingsService.expireBooking(b.id)) {
            count++;
          }
        }
        if (count > 0) {
          this.logger.log(`Sweeper: Đã tự động hủy ${count} đơn giữ ghế quá hạn 5 phút.`);
        }
      }
    } catch (err: any) {
      this.logger.error(`Lỗi Sweeper: ${err.message}`);
    } finally {
      this.sweeping = false;
    }
  }
}