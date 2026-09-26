import { Logger, ServiceUnavailableException } from '@nestjs/common';
import * as nodemailer from 'nodemailer';
import { loadEnv } from '../../config/env';
import { MailerService } from './mailer.service';

jest.mock('../../config/env', () => ({ loadEnv: jest.fn() }));

describe('Password recovery email delivery', () => {
  const testEnvironment: ReturnType<typeof loadEnv> = {
    NODE_ENV: 'test', PORT: 4001,
    DATABASE_URL: 'postgresql://localhost/ehsbha_test_mailer',
    JWT_ACCESS_SECRET: 'test-driver-access-secret-for-mailer',
    JWT_REFRESH_SECRET: 'test-driver-refresh-secret-for-mailer',
    JWT_ACCESS_TTL: '15m', JWT_REFRESH_TTL: '30d',
    ADMIN_JWT_ACCESS_SECRET: 'test-admin-access-secret-for-mailer',
    ADMIN_JWT_REFRESH_SECRET: 'test-admin-refresh-secret-for-mailer',
    ADMIN_JWT_ACCESS_TTL: '15m', ADMIN_JWT_REFRESH_TTL: '8h',
    CORS_ORIGINS: 'http://localhost:5173',
    SMTP_FROM: 'Ehsbha <test@example.invalid>',
    APP_PUBLIC_NAME: 'Ehsbha', APP_PUBLIC_URL: 'https://example.invalid',
    GEMINI_MODEL: 'gemini-3.5-flash',
  };

  beforeEach(() => {
    jest.mocked(loadEnv).mockReturnValue({ ...testEnvironment });
  });

  afterEach(() => jest.restoreAllMocks());

  it('allows isolated test delivery without logging recovery codes', async () => {
    const warning = jest.spyOn(Logger.prototype, 'warn').mockImplementation(() => {});
    await new MailerService().sendResetCode('test@example.invalid', '123456');
    expect(warning).not.toHaveBeenCalled();
  });

  it.each(['production', 'development'] as const)('fails when SMTP is missing in %s', async (mode) => {
    jest.mocked(loadEnv).mockReturnValue({ ...testEnvironment, NODE_ENV: mode });
    await expect(new MailerService().sendResetCode('test@example.invalid', '123456'))
      .rejects.toBeInstanceOf(ServiceUnavailableException);
  });

  it('composes a real message using the patched Nodemailer stream transport', async () => {
    const transport = nodemailer.createTransport({ streamTransport: true, buffer: true });
    const delivery = jest.spyOn(transport, 'sendMail');
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue(transport);
    jest.mocked(loadEnv).mockReturnValue({
      ...testEnvironment, SMTP_HOST: 'smtp.example.invalid', SMTP_PORT: 587,
      SMTP_USER: 'test@example.invalid', SMTP_PASS: 'test-mailer-password-only',
    });
    await new MailerService().sendResetCode('test@example.invalid', '123456', 'ar');
    expect(delivery).toHaveBeenCalledWith(expect.objectContaining({
      to: 'test@example.invalid', text: expect.stringContaining('123456'), html: expect.stringContaining('123456'),
    }));
    transport.close();
  });

  it('returns a safe error and excludes SMTP details from logs', async () => {
    const transport = nodemailer.createTransport({ streamTransport: true });
    jest.spyOn(transport, 'sendMail').mockImplementation(() => { throw new Error('private-provider-diagnostic'); });
    jest.spyOn(nodemailer, 'createTransport').mockReturnValue(transport);
    const log = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
    jest.mocked(loadEnv).mockReturnValue({
      ...testEnvironment, SMTP_HOST: 'smtp.example.invalid', SMTP_PORT: 587,
      SMTP_USER: 'test@example.invalid', SMTP_PASS: 'test-mailer-password-only',
    });
    await expect(new MailerService().sendResetCode('test@example.invalid', '123456'))
      .rejects.toThrow('Email delivery is unavailable');
    expect(log).toHaveBeenCalledWith('Password recovery email delivery failed');
    transport.close();
  });
});
