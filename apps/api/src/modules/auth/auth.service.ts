import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Prisma, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { loadEnv } from '../../config/env';
import { canonicalizeEgyPhone, egyPhoneLookupCandidates } from '../../common/utils/phone';
import { MailerService } from '../mailer/mailer.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface AuthResult {
  user: {
    id: string;
    phone: string;
    email: string | null;
    locale: string;
    timezone: string;
    driverId: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

/**
 * Governed error codes used by this service:
 * - {@link GOVERNED_ERROR_REGISTRY.UNAUTHENTICATED} - when credentials are invalid, refresh token is invalid/expired/reused, or reset request is invalid
 * - {@link GOVERNED_ERROR_REGISTRY.NOT_FOUND} - when user, email, or phone is not found during lookup/recovery
 * - {@link GOVERNED_ERROR_REGISTRY.CONFLICT} - when phone or email is already registered
 * - {@link GOVERNED_ERROR_REGISTRY.FORBIDDEN} - when user lacks permission to perform action
 * - {@link GOVERNED_ERROR_REGISTRY.VALIDATION_ERROR} - when input data fails validation
 */
@Injectable()
export class AuthService {
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly mailer: MailerService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const phone = canonicalizeEgyPhone(dto.phone);
    const email = dto.email.toLowerCase().trim();

    const existingPhone = await this.prisma.user.findFirst({
      where: { phone: { in: egyPhoneLookupCandidates(dto.phone) } },
    });
    if (existingPhone) throw new ConflictException({ code: 'PHONE_TAKEN', message: 'Phone already registered' });

    const existingEmail = await this.prisma.user.findUnique({ where: { email } });
    if (existingEmail) throw new ConflictException({ code: 'EMAIL_TAKEN', message: 'Email already registered' });

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const user = await this.prisma.user.create({
      data: {
        phone,
        email,
        passwordHash,
        locale: dto.locale,
        timezone: dto.timezone,
        driver: {
          create: { displayName: dto.displayName },
        },
      },
      include: { driver: true },
    });

    const tokens = await this.issueTokens(user.id, user.phone, user.driver?.id ?? null);

    // Welcome email — fire-and-forget so a flaky SMTP can't fail registration.
    void this.mailer.sendWelcomeEmail(
      email,
      user.driver?.displayName ?? '',
      user.locale === 'en' ? 'en' : 'ar',
    );

    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        locale: user.locale,
        timezone: user.timezone,
        driverId: user.driver?.id ?? null,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    // Tolerant lookup: try canonical (+20…) form first, then a couple of
    // legacy shapes the user may already exist under. This protects accounts
    // created before backend canonicalization was added.
    const user = await this.prisma.user.findFirst({
      where: { phone: { in: egyPhoneLookupCandidates(dto.phone) } },
      include: { driver: true },
    });
    if (!user || user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid phone or password' });
    }

    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid phone or password' });

    const tokens = await this.issueTokens(user.id, user.phone, user.driver?.id ?? null, dto.deviceId);
    return {
      user: {
        id: user.id,
        phone: user.phone,
        email: user.email,
        locale: user.locale,
        timezone: user.timezone,
        driverId: user.driver?.id ?? null,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const result = await this.prisma.$transaction(async (database) => {
      const tokenHash = sha256(refreshToken);
      const row = await database.refreshToken.findUnique({
        where: { tokenHash },
        include: { user: { include: { driver: true } } },
      });
      if (!row) {
        throw new UnauthorizedException({ code: 'UNAUTHENTICATED', message: 'Invalid refresh token' });
      }

      if (row.revokedAt || row.user.status !== UserStatus.ACTIVE) {
        await database.refreshToken.updateMany({
          where: { userId: row.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return null;
      }

      if (row.expiresAt.getTime() <= Date.now()) {
        throw new UnauthorizedException({ code: 'SESSION_EXPIRED', message: 'Refresh token expired' });
      }

      const consumed = await database.refreshToken.updateMany({
        where: { id: row.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      if (consumed.count !== 1) {
        await database.refreshToken.updateMany({
          where: { userId: row.userId, revokedAt: null },
          data: { revokedAt: new Date() },
        });
        return null;
      }

      const tokens = await this.issueTokens(
        row.user.id,
        row.user.phone,
        row.user.driver?.id ?? null,
        row.deviceId,
        database,
      );

      return {
        user: {
          id: row.user.id,
          phone: row.user.phone,
          email: row.user.email,
          locale: row.user.locale,
          timezone: row.user.timezone,
          driverId: row.user.driver?.id ?? null,
        },
        ...tokens,
      };
    });
    if (!result) throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    return result;
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = sha256(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Look up the email registered to a phone, returned masked. The UI shows
   * this in a read-only field so the user can confirm the destination before
   * we send the OTP — they can't change it (prevents sending the code to an
   * attacker-controlled address).
   */
  async lookupEmailByPhone(phone: string): Promise<{ phone: string; emailMasked: string }> {
    const user = await this.prisma.user.findFirst({
      where: { phone: { in: egyPhoneLookupCandidates(phone) } },
    });
    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'No account is registered with this phone number' });
    }
    if (!user.email) {
      // Account has no email on file — can't reset by email. Surface a
      // distinct code so the UI shows the right "contact support" copy.
      throw new NotFoundException({ code: 'NO_EMAIL_ON_FILE', message: 'No recovery email is linked to this account' });
    }
    return { phone: user.phone, emailMasked: maskEmail(user.email) };
  }

  /**
   * Begin password reset. Phone identifies the account; the OTP goes to the
   * email already on file (never an attacker-supplied value). If the phone is
   * not registered we surface USER_NOT_FOUND so the UI can prompt to register.
   */
  async forgotPassword(args: { phone: string }): Promise<{ sent: boolean; channel: 'email'; emailMasked: string; expiresInMinutes: number; devCode?: string }> {
    const expiresInMinutes = 15;
    const user = await this.prisma.user.findFirst({
      where: { phone: { in: egyPhoneLookupCandidates(args.phone) } },
    });

    if (!user) {
      throw new NotFoundException({ code: 'USER_NOT_FOUND', message: 'No account is registered with this phone number' });
    }
    if (!user.email) {
      throw new NotFoundException({ code: 'NO_EMAIL_ON_FILE', message: 'No recovery email is linked to this account' });
    }

    await this.prisma.passwordResetToken.updateMany({
      where: { userId: user.id, usedAt: null },
      data: { usedAt: new Date() },
    });

    const code = generateNumericCode(6);
    await this.prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        codeHash: sha256(code),
        expiresAt: new Date(Date.now() + expiresInMinutes * 60_000),
      },
    });

    const emailTarget = user.email.toLowerCase().trim();
    await this.mailer.sendResetCode(emailTarget, code, user.locale === 'en' ? 'en' : 'ar');

    return {
      sent: true,
      channel: 'email',
      emailMasked: maskEmail(user.email),
      expiresInMinutes,
      ...(process.env.NODE_ENV === 'test' ? { devCode: code } : {}),
    };
  }

  async resetPassword(phone: string, code: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findFirst({
      where: { phone: { in: egyPhoneLookupCandidates(phone) } },
    });
    if (!user) {
      throw new UnauthorizedException({ code: 'RESET_INVALID', message: 'Invalid reset request' });
    }

    const codeHash = sha256(code);
    const token = await this.prisma.passwordResetToken.findFirst({
      where: {
        userId: user.id,
        usedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!token) {
      throw new UnauthorizedException({ code: 'RESET_EXPIRED', message: 'No active reset request — request a new code' });
    }

    if (token.attempts >= 5) {
      // Lock this token after too many wrong attempts.
      await this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      });
      throw new UnauthorizedException({ code: 'RESET_LOCKED', message: 'Too many wrong attempts — request a new code' });
    }

    if (token.codeHash !== codeHash) {
      await this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { attempts: { increment: 1 } },
      });
      throw new UnauthorizedException({ code: 'RESET_CODE_WRONG', message: 'Wrong code' });
    }

    const passwordHash = await argon2.hash(newPassword, { type: argon2.argon2id });

    await this.prisma.$transaction(async (database) => {
      const consumed = await database.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null, attempts: { lt: 5 }, expiresAt: { gt: new Date() } },
        data: { usedAt: new Date() },
      });
      if (consumed.count !== 1) {
        throw new UnauthorizedException({ code: 'RESET_INVALID', message: 'Invalid reset request' });
      }
      await database.user.update({
        where: { id: user.id },
        data: { passwordHash },
      });
      await database.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    });
  }

  private async issueTokens(
    userId: string,
    phone: string,
    driverId: string | null,
    deviceId: string | null = null,
    database: Prisma.TransactionClient = this.prisma,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const refreshToken = randomBytes(48).toString('base64url');
    const tokenHash = sha256(refreshToken);
    const expiresAt = new Date(Date.now() + parseDurationMs(this.env.JWT_REFRESH_TTL));

    const session = await database.refreshToken.create({
      data: {
        userId,
        tokenHash,
        deviceId,
        expiresAt,
      },
    });

    const accessToken = await this.jwt.signAsync(
      { sub: userId, phone, driverId, sid: session.id },
      {
        secret: this.env.JWT_ACCESS_SECRET,
        algorithm: 'HS256',
        expiresIn: Math.floor(parseDurationMs(this.env.JWT_ACCESS_TTL) / 1000),
      },
    );

    return { accessToken, refreshToken };
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function generateNumericCode(digits: number): string {
  // Cryptographically secure 6-digit code (rejection sampling for uniformity)
  const max = 10 ** digits;
  let n: number;
  do {
    n = randomBytes(4).readUInt32BE(0);
  } while (n >= Math.floor(0xFFFFFFFF / max) * max);
  return String(n % max).padStart(digits, '0');
}

function maskEmail(email: string): string {
  const at = email.lastIndexOf('@');
  if (at <= 0) return email;
  const local = email.slice(0, at);
  const domain = email.slice(at + 1);
  // Keep first + last char of local; mask the middle. Short locals (≤2) get
  // a single visible char prefix only.
  const visibleHead = local.charAt(0);
  const visibleTail = local.length > 2 ? local.charAt(local.length - 1) : '';
  const maskedLocal = visibleTail
    ? `${visibleHead}***${visibleTail}`
    : `${visibleHead}***`;
  return `${maskedLocal}@${domain}`;
}

function parseDurationMs(s: string): number {
  const m = /^(\d+)\s*(s|m|h|d)$/.exec(s.trim());
  if (!m) throw new Error('Unsupported token duration');
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default: throw new Error('Unsupported token duration');
  }
}
