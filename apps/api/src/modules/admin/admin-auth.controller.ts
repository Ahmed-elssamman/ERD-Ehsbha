import { Body, Controller, Post, Req, UseGuards } from '@nestjs/common';
import type { Request } from 'express';
import { z } from 'zod';
import { ZodValidationPipe } from '../../common/pipes/zod.pipe';
import { AdminAuthService } from './admin-auth.service';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { CurrentAdmin } from './current-admin.decorator';
import type { AuthenticatedAdmin } from './admin.types';
// Shared admin auth schemas available via @ehsbha/api-contracts (adminLoginSchema in auth-profile.ts)

const AdminLoginSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
});

const AdminMfaVerifySchema = z.object({
  challengeId: z.string(),
  code: z.string().regex(/^\d{6}$/),
});

const AdminRefreshSchema = z.object({
  refreshToken: z.string().min(10),
});

@Controller('admin/auth')
export class AdminAuthController {
  constructor(private readonly auth: AdminAuthService) {}

  @Post('login')
  login(
    @Req() req: Request,
    @Body(new ZodValidationPipe(AdminLoginSchema)) dto: z.infer<typeof AdminLoginSchema>,
  ) {
    return this.auth.login({
      email: dto.email,
      password: dto.password,
      ip: req.ip,
      userAgent: req.headers['user-agent'] ?? undefined,
    });
  }

  @Post('mfa/verify')
  verifyMfa(@Body(new ZodValidationPipe(AdminMfaVerifySchema)) dto: z.infer<typeof AdminMfaVerifySchema>) {
    return this.auth.verifyMfa(dto.challengeId, dto.code);
  }

  @Post('refresh')
  refresh(@Body(new ZodValidationPipe(AdminRefreshSchema)) dto: z.infer<typeof AdminRefreshSchema>) {
    return this.auth.refresh(dto.refreshToken);
  }

  @Post('logout')
  @UseGuards(AdminJwtAuthGuard)
  async logout(
    @CurrentAdmin() _admin: AuthenticatedAdmin,
    @Body(new ZodValidationPipe(AdminRefreshSchema)) dto: z.infer<typeof AdminRefreshSchema>,
  ) {
    await this.auth.logout(dto.refreshToken);
    return { ok: true };
  }

  @Post('me')
  @UseGuards(AdminJwtAuthGuard)
  me(@CurrentAdmin() admin: AuthenticatedAdmin) {
    return admin;
  }
}
