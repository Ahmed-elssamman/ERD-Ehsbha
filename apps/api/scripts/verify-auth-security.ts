import assert from 'node:assert/strict';
import { randomInt } from 'node:crypto';
import { UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Test } from '@nestjs/testing';
import { PrismaClient, UserStatus } from '@prisma/client';
import * as argon2 from 'argon2';
import { loadEnv } from '../src/config/env';
import { PrismaService } from '../src/prisma/prisma.service';
import { AuthService } from '../src/modules/auth/auth.service';
import { JwtStrategy } from '../src/modules/auth/jwt.strategy';
import { MailerService } from '../src/modules/mailer/mailer.service';

interface SessionClaims {
  sub: string;
  sid: string;
}

/** Exercises persisted session revocation and competing mutations on PostgreSQL. */
export async function verifyAuthSecurity(database: PrismaClient): Promise<void> {
  const env = loadEnv();
  const moduleRef = await Test.createTestingModule({
    providers: [
      { provide: PrismaService, useValue: database },
      AuthService, JwtStrategy, JwtService, MailerService,
    ],
  }).compile();
  const auth = moduleRef.get(AuthService);
  const strategy = moduleRef.get(JwtStrategy);
  const jwt = moduleRef.get(JwtService);
  const phone = `+2010${randomInt(10_000_000, 100_000_000)}`;
  const password = 'test-driver-revocation-only';
  const user = await database.user.create({
    data: {
      phone, email: `${phone.slice(1)}@example.invalid`,
      passwordHash: await argon2.hash(password),
      driver: { create: { displayName: 'Session security test' } },
    },
    include: { driver: true },
  });
  const authenticate = async (token: string) => strategy.validate(
    await jwt.verifyAsync<SessionClaims>(token, { secret: env.JWT_ACCESS_SECRET, algorithms: ['HS256'] }),
  );

  try {
    const active = await auth.login({ phone, password });
    assert.equal((await authenticate(active.accessToken)).driverId, user.driver?.id);
    await assert.rejects(auth.login({ phone, password: 'test-incorrect-password' }), UnauthorizedException);
    await assert.rejects(strategy.validate({ sub: user.id, sid: '' }), UnauthorizedException);
    const claims = await jwt.verifyAsync<SessionClaims>(active.accessToken, { secret: env.JWT_ACCESS_SECRET });
    await assert.rejects(strategy.validate({ ...claims, sub: 'different-user' }), UnauthorizedException);

    for (const status of [UserStatus.SUSPENDED, UserStatus.DELETED]) {
      await database.user.update({ where: { id: user.id }, data: { status } });
      await assert.rejects(auth.login({ phone, password }), UnauthorizedException);
      await assert.rejects(authenticate(active.accessToken), UnauthorizedException);
      await assert.rejects(auth.refresh(active.refreshToken), UnauthorizedException);
    }
    await database.user.update({ where: { id: user.id }, data: { status: UserStatus.ACTIVE } });
    await assert.rejects(authenticate(active.accessToken), UnauthorizedException);

    const logout = await auth.login({ phone, password });
    await auth.logout(logout.refreshToken);
    await assert.rejects(authenticate(logout.accessToken), UnauthorizedException);
    await assert.rejects(auth.refresh(logout.refreshToken), UnauthorizedException);

    const original = await auth.login({ phone, password });
    const rotated = await auth.refresh(original.refreshToken);
    await assert.rejects(authenticate(original.accessToken), UnauthorizedException);
    assert.equal((await authenticate(rotated.accessToken)).userId, user.id);
    await assert.rejects(auth.refresh(original.refreshToken), UnauthorizedException);
    await assert.rejects(authenticate(rotated.accessToken), UnauthorizedException);

    const concurrent = await auth.login({ phone, password });
    const refreshes = await Promise.allSettled([
      auth.refresh(concurrent.refreshToken), auth.refresh(concurrent.refreshToken),
    ]);
    assert.equal(refreshes.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(refreshes.filter((result) => result.status === 'rejected').length, 1);
    assert.equal(await database.refreshToken.count({ where: { userId: user.id, revokedAt: null } }), 0);

    const resetSession = await auth.login({ phone, password });
    const recovery = await auth.forgotPassword({ phone });
    assert(recovery.devCode);
    const newPassword = 'test-driver-after-reset-only';
    const resets = await Promise.allSettled([
      auth.resetPassword(phone, recovery.devCode, newPassword),
      auth.resetPassword(phone, recovery.devCode, newPassword),
    ]);
    assert.equal(resets.filter((result) => result.status === 'fulfilled').length, 1);
    assert.equal(resets.filter((result) => result.status === 'rejected').length, 1);
    await assert.rejects(authenticate(resetSession.accessToken), UnauthorizedException);
    await assert.rejects(auth.login({ phone, password }), UnauthorizedException);
    const resetLogin = await auth.login({ phone, password: newPassword });
    assert.equal((await authenticate(resetLogin.accessToken)).userId, user.id);

    const expired = await jwt.verifyAsync<SessionClaims>(resetLogin.accessToken, { secret: env.JWT_ACCESS_SECRET });
    await database.refreshToken.update({ where: { id: expired.sid }, data: { expiresAt: new Date(0) } });
    await assert.rejects(authenticate(resetLogin.accessToken), UnauthorizedException);
    await assert.rejects(auth.refresh(resetLogin.refreshToken), UnauthorizedException);
  } finally {
    await database.user.delete({ where: { id: user.id } });
    await moduleRef.close();
  }
}
