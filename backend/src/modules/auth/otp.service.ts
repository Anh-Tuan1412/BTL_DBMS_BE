import {
  BadRequestException,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { createHash, createHmac, randomInt } from 'node:crypto';
import { RedisService } from '../redis/redis.service';
import { EmailService } from './email.service';

type Purpose = 'verify' | 'reset';

@Injectable()
export class OtpService {
  constructor(
    private readonly redis: RedisService,
    private readonly mail: EmailService,
    private readonly config: ConfigService,
  ) {}

  private key(email: string, purpose: Purpose) {
    return `auth:otp:${purpose}:${createHash('sha256').update(email.toLowerCase().trim()).digest('hex')}`;
  }

  private digest(email: string, purpose: Purpose, code: string) {
    return createHmac(
      'sha256',
      this.config.get<string>(
        'JWT_SECRET',
        'super_secret_jwt_key_movie_booking_2026',
      ),
    )
      .update(`${email.toLowerCase().trim()}:${purpose}:${code}`)
      .digest('hex');
  }

  delivery() {
    return this.mail.delivery();
  }

  async issue(email: string, purpose: Purpose, deliver = true) {
    this.mail.delivery();
    const key = this.key(email, purpose);
    const client = this.redis.getClient();
    if (!(await client.set(`${key}:cooldown`, '1', 'EX', 60, 'NX'))) {
      throw new HttpException(
        'Vui lòng chờ 60 giây trước khi yêu cầu mã mới.',
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }
    if (!deliver) return;
    const code = String(randomInt(100000, 1000000));
    await client
      .multi()
      .set(key, this.digest(email, purpose, code), 'EX', 600)
      .del(`${key}:attempts`)
      .exec();
    try {
      await this.mail.sendCode(email, code, purpose);
    } catch (error) {
      await client.del(key, `${key}:cooldown`);
      throw error;
    }
  }

  async consume(email: string, purpose: Purpose, code: string) {
    const key = this.key(email, purpose);
    const result = await this.redis.getClient().eval(
      `
      local expected = redis.call('GET', KEYS[1])
      if not expected then return 0 end
      if expected ~= ARGV[1] then
        local attempts = redis.call('INCR', KEYS[2])
        redis.call('EXPIRE', KEYS[2], 600)
        if attempts >= 5 then redis.call('DEL', KEYS[1]) end
        return 0
      end
      redis.call('DEL', KEYS[1], KEYS[2])
      return 1
    `,
      2,
      key,
      `${key}:attempts`,
      this.digest(email, purpose, code),
    );
    if (result !== 1)
      throw new BadRequestException(
        'Mã không đúng, đã dùng hoặc hết hạn. Vui lòng yêu cầu mã mới.',
      );
  }
}
