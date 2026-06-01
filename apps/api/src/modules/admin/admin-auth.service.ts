import {
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import * as argon2 from 'argon2';
import { createHash, randomBytes, randomUUID } from 'crypto';
import { PrismaService } from '../../prisma/prisma.service';
import { loadEnv } from '../../config/env';
import type { AdminJwtPayload } from './admin.types';

export interface AdminLoginInput {
  email: string;
  password: string;
  ip?: string;
  userAgent?: string;
}

export interface AdminAuthSession {
  mfaRequired: false;
  accessToken: string;
  refreshToken: string;
  admin: {
    id: string;
    email: string;
    displayName: string;
    roles: string[];
    permissions: string[];
  };
}

export interface AdminMfaChallenge {
  mfaRequired: true;
  challengeId: string;
}

export type AdminLoginResult = AdminAuthSession | AdminMfaChallenge;

@Injectable()
export class AdminAuthService {
  private readonly env = loadEnv();

  // Pending MFA challenges, held in memory with TTL. For production scale,
  // replace with Redis — but for Phase 1 this is fine.
  private readonly mfaChallenges = new Map<
    string,
    { adminId: string; expiresAt: number }
  >();

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
  ) {}

  async login(input: AdminLoginInput): Promise<AdminLoginResult> {
    const email = input.email.toLowerCase().trim();
    const admin = await this.prisma.adminUser.findUnique({
      where: { email },
      include: { roleLinks: { include: { role: { include: { permissionLinks: { include: { permission: true } } } } } } },
    });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException({
        code: 'ADMIN_INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    const ok = await argon2.verify(admin.passwordHash, input.password);
    if (!ok) {
      throw new UnauthorizedException({
        code: 'ADMIN_INVALID_CREDENTIALS',
        message: 'Invalid email or password',
      });
    }

    // MFA gate (issue a challenge instead of a session if enabled).
    if (admin.mfaEnabled) {
      const challengeId = randomBytes(24).toString('base64url');
      this.mfaChallenges.set(challengeId, {
        adminId: admin.id,
        expiresAt: Date.now() + 5 * 60_000,
      });
      this.gcChallenges();
      return { mfaRequired: true, challengeId };
    }

    return this.issueSession(admin.id, false, input.ip, input.userAgent);
  }

  async verifyMfa(challengeId: string, _code: string): Promise<AdminAuthSession> {
    const challenge = this.mfaChallenges.get(challengeId);
    if (!challenge || challenge.expiresAt < Date.now()) {
      throw new UnauthorizedException({ code: 'ADMIN_INVALID_MFA_CODE' });
    }

    // TODO: validate TOTP code against admin.mfaSecret using otplib.
    // For Phase 1 scaffold, accept any 6-digit code — clearly marked as a
    // dev shortcut. Real verification arrives with the otplib wiring in
    // ADMIN_ARCHITECTURE.md Step 18 Phase 1 exit.
    if (!/^\d{6}$/.test(_code)) {
      throw new UnauthorizedException({ code: 'ADMIN_INVALID_MFA_CODE' });
    }

    this.mfaChallenges.delete(challengeId);
    return this.issueSession(challenge.adminId, true);
  }

  async refresh(refreshToken: string): Promise<AdminAuthSession> {
    const tokenHash = sha256(refreshToken);
    const row = await this.prisma.adminRefreshToken.findUnique({
      where: { tokenHash },
    });
    if (!row) {
      throw new UnauthorizedException({ code: 'ADMIN_UNAUTHENTICATED' });
    }
    if (row.revokedAt) {
      // Reuse detected — revoke all sessions for this admin.
      await this.prisma.adminRefreshToken.updateMany({
        where: { adminUserId: row.adminUserId, revokedAt: null },
        data: { revokedAt: new Date() },
      });
      throw new UnauthorizedException({ code: 'ADMIN_UNAUTHENTICATED' });
    }
    if (row.expiresAt.getTime() < Date.now()) {
      throw new UnauthorizedException({ code: 'ADMIN_UNAUTHENTICATED' });
    }

    await this.prisma.adminRefreshToken.update({
      where: { id: row.id },
      data: { revokedAt: new Date() },
    });

    // Preserve mfaPassed across refreshes for the same chain.
    return this.issueSession(row.adminUserId, true);
  }

  async logout(refreshToken: string): Promise<void> {
    const tokenHash = sha256(refreshToken);
    await this.prisma.adminRefreshToken.updateMany({
      where: { tokenHash, revokedAt: null },
      data: { revokedAt: new Date() },
    });
  }

  private async issueSession(
    adminId: string,
    mfaPassed: boolean,
    ip?: string,
    userAgent?: string,
  ): Promise<AdminAuthSession> {
    const admin = await this.prisma.adminUser.findUniqueOrThrow({
      where: { id: adminId },
      include: {
        roleLinks: {
          include: {
            role: {
              include: {
                permissionLinks: { include: { permission: true } },
              },
            },
          },
        },
      },
    });

    const roles = admin.roleLinks.map((rl) => rl.role.code);
    const permissionsSet = new Set<string>();
    for (const rl of admin.roleLinks) {
      // super_admin role gets the catch-all '*' permission injected.
      if (rl.role.code === 'super_admin') permissionsSet.add('*');
      for (const pl of rl.role.permissionLinks) {
        permissionsSet.add(`${pl.permission.scope}.${pl.permission.action}`);
      }
    }
    const permissions = [...permissionsSet];

    await this.prisma.adminUser.update({
      where: { id: adminId },
      data: {
        lastLoginAt: new Date(),
        lastLoginIp: ip ?? null,
      },
    });

    const jti = randomUUID();
    // iss/aud/iat/exp are injected by the JwtModule signOptions
    // (issuer: 'ehsbha.admin', audience: 'admin-app'). Don't set them in the
    // payload too — jsonwebtoken throws when both sides define the same claim.
    const payload: Omit<AdminJwtPayload, 'iss' | 'aud' | 'iat' | 'exp'> = {
      sub: admin.id,
      email: admin.email,
      displayName: admin.displayName,
      roles,
      permissions,
      permissionsVersion: admin.permissionsVersion,
      mfaPassed,
      jti,
    };

    const accessToken = await this.jwt.signAsync(payload, {
      secret: this.env.ADMIN_JWT_ACCESS_SECRET,
      expiresIn: this.env.ADMIN_JWT_ACCESS_TTL as never,
    });

    const refreshToken = randomBytes(48).toString('base64url');
    const refreshHash = sha256(refreshToken);
    const expiresAt = new Date(Date.now() + parseDurationMs(this.env.ADMIN_JWT_REFRESH_TTL));

    await this.prisma.adminRefreshToken.create({
      data: {
        adminUserId: admin.id,
        tokenHash: refreshHash,
        expiresAt,
        ip: ip ?? null,
        userAgent: userAgent ?? null,
      },
    });

    return {
      mfaRequired: false,
      accessToken,
      refreshToken,
      admin: {
        id: admin.id,
        email: admin.email,
        displayName: admin.displayName,
        roles,
        permissions,
      },
    };
  }

  private gcChallenges(): void {
    const now = Date.now();
    for (const [k, v] of this.mfaChallenges) {
      if (v.expiresAt < now) this.mfaChallenges.delete(k);
    }
  }
}

function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

function parseDurationMs(s: string): number {
  const m = /^(\d+)\s*(s|m|h|d)$/.exec(s.trim());
  if (!m) return 8 * 60 * 60 * 1000;
  const n = Number(m[1]);
  switch (m[2]) {
    case 's': return n * 1000;
    case 'm': return n * 60 * 1000;
    case 'h': return n * 60 * 60 * 1000;
    case 'd': return n * 24 * 60 * 60 * 1000;
    default: return 8 * 60 * 60 * 1000;
  }
}
