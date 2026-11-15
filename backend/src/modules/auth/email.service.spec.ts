import { ServiceUnavailableException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { EmailService } from './email.service';

describe('Email delivery configuration', () => {
  afterEach(() => jest.restoreAllMocks());

  it('allows explicit console delivery in development', () => {
    expect(
      new EmailService(
        new ConfigService({
          NODE_ENV: 'development',
          EMAIL_DELIVERY: 'console',
        }),
      ).delivery(),
    ).toBe('console');
  });

  it('rejects console delivery in production', () => {
    expect(() =>
      new EmailService(
        new ConfigService({
          NODE_ENV: 'production',
          EMAIL_DELIVERY: 'console',
        }),
      ).delivery(),
    ).toThrow(ServiceUnavailableException);
  });

  it('rejects an incomplete email provider configuration', () => {
    expect(() =>
      new EmailService(
        new ConfigService({ NODE_ENV: 'production', EMAIL_DELIVERY: 'resend' }),
      ).delivery(),
    ).toThrow(ServiceUnavailableException);
  });

  it('does not report a failed provider request as delivered', async () => {
    jest
      .spyOn(globalThis, 'fetch')
      .mockResolvedValue(new Response('', { status: 503 }));
    const mail = new EmailService(
      new ConfigService({
        NODE_ENV: 'production',
        EMAIL_DELIVERY: 'resend',
        EMAIL_API_KEY: 'unit-test-only',
        EMAIL_FROM: 'test@example.com',
      }),
    );
    await expect(
      mail.sendCode('recipient@example.com', '123456', 'reset'),
    ).rejects.toThrow(ServiceUnavailableException);
  });
});
