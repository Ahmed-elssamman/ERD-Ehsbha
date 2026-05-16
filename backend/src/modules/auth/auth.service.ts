import {
  ConflictException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { loadEnv } from '../../config/env';
import { LoginDto, RegisterDto } from './dto/auth.dto';

export interface AuthResult {
  user: {
    id: string;
    phone: string;
    locale: string;
    timezone: string;
    driverId: string | null;
  };
  accessToken: string;
  refreshToken: string;
}

@Injectable()
export class AuthService {
  private readonly env = loadEnv();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async register(dto: RegisterDto): Promise<AuthResult> {
    const existing = await this.prisma.user.findUnique({ where: { phone: dto.phone } });
    if (existing) throw new ConflictException({ code: 'PHONE_TAKEN', message: 'Phone already registered' });

    const passwordHash = await argon2.hash(dto.password, { type: argon2.argon2id });

    const user = await this.prisma.user.create({
      data: {
        phone: dto.phone,
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
    return {
      user: {
        id: user.id,
        phone: user.phone,
        locale: user.locale,
        timezone: user.timezone,
        driverId: user.driver?.id ?? null,
      },
      ...tokens,
    };
  }

  async login(dto: LoginDto): Promise<AuthResult> {
    const user = await this.prisma.user.findUnique({
      where: { phone: dto.phone },
      include: { driver: true },
    });
    if (!user) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid phone or password' });

    const ok = await argon2.verify(user.passwordHash, dto.password);
    if (!ok) throw new UnauthorizedException({ code: 'INVALID_CREDENTIALS', message: 'Invalid phone or password' });

    const tokens = await this.issueTokens(user.id, user.phone, user.driver?.id ?? null, dto.deviceId);
    return {
      user: {
        id: user.id,
        phone: user.phone,
        locale: user.locale,
        timezone: user.timezone,
        driverId: user.driver?.id ?? null,
      },
      ...tokens,
    };
  }

  async refresh(refreshToken: string): Promise<AuthResult> {
    const tokenHash = sha256(refreshToken);
    const row = await this.prisma.refreshToken.findUnique({
      where: { tokenHash },
      include: { user: { include: { driver: true } } },
    });
    if (!row) {
      throw new UnauthorizedException({ code: 'REFRESH_INVALID', message: 'Invalid refresh token' });
    }

    if (row.revokedAt) {
      await this.prisma.refreshToken.updateMany({
        where: { userId: row.userId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({ code: 'REFRESH_REUSED', message: 'Refresh token reused — all sessions revoked' });
    }

    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({ code: 'REFRESH_EXPIRED', message: 'Refresh token expired' });
    }

    await this.prisma.refreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });

    const tokens = await this.issueTokens(
      row.user.id,
      row.user.phone,
      row.user.driver?.id ?? null,
      row.deviceId ?? undefined,
    );

    return {
      user: {
        id: row.user.id,
        phone: row.user.phone,
        locale: row.user.locale,
        timezone: row.user.timezone,
        driverId: row.user.driver?.id ?? null,
      },
      ...tokens,
    };
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = sha256(refreshToken);
    await this.prisma.refreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  /**
   * Begin password reset. Returns the code in dev mode so the driver can copy it
   * (no SMS provider yet). In prod, the code is sent via SMS and not returned.
   *
   * Security:
   *  - Always returns the same shape regardless of whether the phone exists,
   *    so an attacker can't enumerate registered phones.
   *  - Any previous unused codes for the user are invalidated.
   *  - Code is hashed before storage.
   */
  async forgotPassword(phone: string): Promise<{ sent: boolean; devCode?: string; expiresInMinutes: number }> {
    const expiresInMinutes = 15;
    const user = await this.prisma.user.findUnique({ where: { phone } });

    if (!user) {
      // Don't leak whether the phone is registered. Pretend we sent.
      return { sent: true, expiresInMinutes };
    }

    // Invalidate any previously-unused codes
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

    const isProd = process.env.NODE_ENV === 'production';
    if (!isProd) {
      // Dev: surface the code so the driver can finish the flow without an SMS provider.
      // Replace with an SMS gateway call here when one is wired in.
      // eslint-disable-next-line no-console
      console.log(`[reset-password] phone=${phone} code=${code} (dev only)`);
    }

    return {
      sent: true,
      expiresInMinutes,
      ...(isProd ? {} : { devCode: code }),
    };
  }

  async resetPassword(phone: string, code: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({ where: { phone } });
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

    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash },
      }),
      this.prisma.passwordResetToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      }),
      // Revoke all active refresh tokens — force all devices to log in again.
      this.prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
  }

  private async issueTokens(
    userId: string,
    phone: string,
    driverId: string | null,
    deviceId?: string,
  ): Promise<{ accessToken: string; refreshToken: string }> {
    const accessToken = await this.jwt.signAsync(
      { sub: userId, phone, driverId },
      {
        secret: this.env.JWT_ACCESS_SECRET,
        expiresIn: this.env.JWT_ACCESS_TTL as any,
      },
    );

    const refreshToken = randomBytes(48).toString('base64url');
    const tokenHash = sha256(refreshToken);
    const expiresAt = new Date(Date.now() + parseDurationMs(this.env.JWT_REFRESH_TTL));

    await this.prisma.refreshToken.create({
      data: {
        userId,
        tokenHash,
        deviceId: deviceId ?? null,
        expiresAt,
      },
    });

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

function parseDurationMs(s: string): number {
  const m = /^(\d+)\s*(s|m|h|d)$/.exec(s.trim());
  if (!m) return 30 * 24 * 60 * 60 * 1000;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default:  return 30 * 24 * 60 * 60 * 1000;
  }
}
