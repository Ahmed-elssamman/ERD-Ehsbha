import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { loadEnv } from '../../config/env';
import { PrismaService } from '../../prisma/prisma.service';
import type { AdminJwtPayload, AuthenticatedAdmin } from './admin.types';

@Injectable()
export class AdminJwtStrategy extends PassportStrategy(Strategy, 'admin-jwt') {
  constructor(private readonly prisma: PrismaService) {
    const env = loadEnv();
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.ADMIN_JWT_ACCESS_SECRET,
      issuer: 'ehsbha.admin',
      audience: 'admin-app',
    });
  }

  async validate(payload: AdminJwtPayload): Promise<AuthenticatedAdmin> {
    // Defense in depth — even though the JWT layer verified iss/aud, we
    // re-check here so any future strategy change still fails closed.
    if (payload.iss !== 'ehsbha.admin' || payload.aud !== 'admin-app') {
      throw new UnauthorizedException({ code: 'ADMIN_UNAUTHENTICATED' });
    }

    const admin = await this.prisma.adminUser.findUnique({
      where: { id: payload.sub },
      select: { id: true, isActive: true, permissionsVersion: true },
    });
    if (!admin || !admin.isActive) {
      throw new UnauthorizedException({ code: 'ADMIN_ACCOUNT_DISABLED' });
    }
    if (admin.permissionsVersion !== payload.permissionsVersion) {
      throw new UnauthorizedException({ code: 'ADMIN_PERMISSIONS_STALE' });
    }

    return {
      id: payload.sub,
      email: payload.email,
      displayName: payload.displayName,
      roles: payload.roles,
      permissions: payload.permissions,
      permissionsVersion: payload.permissionsVersion,
      mfaPassed: payload.mfaPassed,
    };
  }
}
