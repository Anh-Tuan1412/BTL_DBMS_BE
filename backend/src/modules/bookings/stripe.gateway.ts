import {
  BadRequestException,
  Injectable,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';

@Injectable()
export class StripeGateway {
  constructor(private readonly config: ConfigService) {}
  client() {
    const key = this.config.get<string>('STRIPE_SECRET_KEY', '');
    if (!/^(sk|rk)_test_/.test(key) || /mock/i.test(key)) {
      throw new ServiceUnavailableException(
        'Cần cấu hình STRIPE_SECRET_KEY của Stripe Test Mode',
      );
    }
    return new Stripe(key, {
      httpClient: Stripe.createFetchHttpClient(),
      maxNetworkRetries: 2,
      timeout: 15000,
    });
  }
  frontendUrl() {
    const url = new URL(
      this.config.get<string>('FRONTEND_URL', 'http://localhost:3001'),
    );
    if (!['http:', 'https:'].includes(url.protocol))
      throw new ServiceUnavailableException('FRONTEND_URL không hợp lệ');
    return url.origin;
  }
  event(body: Buffer, signature: string) {
    const secret = this.config.get<string>('STRIPE_WEBHOOK_SECRET');
    if (!secret)
      throw new ServiceUnavailableException(
        'Chưa cấu hình STRIPE_WEBHOOK_SECRET',
      );
    try {
      return this.client().webhooks.constructEvent(body, signature, secret);
    } catch {
      throw new BadRequestException('Chữ ký Stripe webhook không hợp lệ');
    }
  }
}
