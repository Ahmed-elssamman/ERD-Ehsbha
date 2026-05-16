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
