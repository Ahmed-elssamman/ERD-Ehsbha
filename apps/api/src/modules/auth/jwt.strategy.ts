import { Injectable, UnauthorizedException } from '@nestjs/common';
import { UserStatus } from '@prisma/client';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { loadEnv } from '../../config/env';
import { AuthUser } from '../../common/decorators/current-user.decorator';
import { PrismaService } from '../../prisma/prisma.service';

interface JwtPayload {
  sub: string;
  sid: string;
}

@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private prisma: PrismaService) {
    const env = loadEnv();
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: env.JWT_ACCESS_SECRET,
      algorithms: ['HS256'],
    });
  }

  async validate(payload: JwtPayload): Promise<AuthUser> {
    if (!payload || typeof payload.sub !== 'string' || !payload.sub
      || typeof payload.sid !== 'string' || !payload.sid) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }
    const session = await this.prisma.refreshToken.findUnique({
      where: { id: payload.sid },
      select: {
        userId: true, revokedAt: true, expiresAt: true,
        user: { select: { id: true, phone: true, status: true, driver: { select: { id: true } } } },
      },
    });
    if (!session || session.userId !== payload.sub || session.revokedAt
      || session.expiresAt.getTime() <= Date.now() || session.user.status !== UserStatus.ACTIVE) {
      throw new UnauthorizedException({ code: 'UNAUTHENTICATED' });
    }
    return {
      userId: session.user.id,
      driverId: session.user.driver?.id ?? null,
      phone: session.user.phone,
    };
  }
}
