import {
  Injectable,
  Logger,
  ServiceUnavailableException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  constructor(private readonly config: ConfigService) {}

  delivery() {
    const mode = this.config.get<string>('EMAIL_DELIVERY', 'console');
    if (
      mode === 'console' &&
      ['development', 'test'].includes(
        this.config.get('NODE_ENV', 'development'),
      )
    )
      return 'console';
    if (
      mode === 'resend' &&
      this.config.get('EMAIL_API_KEY') &&
      this.config.get('EMAIL_FROM')
    )
      return 'email';
    throw new ServiceUnavailableException('Chưa cấu hình dịch vụ gửi email');
  }

  async sendCode(email: string, code: string, purpose: 'verify' | 'reset') {
    const delivery = this.delivery();
    const subject =
      purpose === 'verify'
        ? 'Xác thực tài khoản CineBook'
        : 'Đặt lại mật khẩu CineBook';
    if (delivery === 'console') {
      this.logger.log(
        `[DEV EMAIL] ${email} | ${subject} | OTP: ${code} | Hết hạn sau 10 phút`,
      );
      return;
    }
    const response = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.config.get<string>('EMAIL_API_KEY')}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: this.config.get('EMAIL_FROM'),
        to: [email],
        subject,
        text: `Mã CineBook của bạn: ${code}. Có hiệu lực trong 10 phút. Không chia sẻ mã này.`,
      }),
      signal: AbortSignal.timeout(10000),
    }).catch(() => null);
    if (!response?.ok)
      throw new ServiceUnavailableException(
        'Không thể gửi email. Vui lòng thử lại sau.',
      );
  }
}
