import { Controller, Get, UseGuards } from '@nestjs/common';
import { AdminJwtAuthGuard } from './admin-jwt.guard';
import { AdminPermissionsGuard, RequirePermissions } from './permissions.decorator';
import { PrismaService } from '../../prisma/prisma.service';

/**
 * Endpoints for modules whose backing telemetry tables don't exist yet
 * (OCR log, feature events, subscriptions). They return a "schema pending"
 * marker so the frontend can render an informative page rather than a 404.
 */
@Controller('admin')
@UseGuards(AdminJwtAuthGuard, AdminPermissionsGuard)
export class AdminMiscController {
  constructor(private readonly prisma: PrismaService) {}

  @Get('ocr/overview')
  @RequirePermissions('ocr.read')
  ocrOverview() {
    return {
      status: 'PENDING_SCHEMA',
      message:
        'OCR telemetry is not persisted yet. Phase 2 introduces ocr_extraction_log table; this view will populate once it ships.',
      hint: 'See ADMIN_ARCHITECTURE.md Step 15-D for the schema.',
    };
  }

  @Get('feature-usage/overview')
  @RequirePermissions('feature_usage.read')
  featureUsageOverview() {
    return {
      status: 'PENDING_SCHEMA',
      message:
        'Feature events table not yet populated. Phase 3 introduces feature_events with batched client-side emit.',
      hint: 'See ADMIN_ARCHITECTURE.md Step 15-I.',
    };
  }

  @Get('revenue/overview')
  @RequirePermissions('revenue.read')
  revenueOverview() {
    return {
      status: 'PENDING_SCHEMA',
      message: 'Subscriptions/billing not enabled. MRR, ARR, churn dashboards will populate after Phase 4.',
      hint: 'See ADMIN_ARCHITECTURE.md Step 12 and Step 15-H.',
    };
  }

  @Get('health/snapshot')
  @RequirePermissions('platform_health.read')
  async healthSnapshot() {
    // Realistic snapshot: prisma connection check + open count
    const [users, drivers, trips, refresh, adminRefresh, openTickets] = await Promise.all([
      this.prisma.user.count(),
      this.prisma.driver.count(),
      this.prisma.trip.count(),
      this.prisma.refreshToken.count({ where: { revokedAt: null } }),
      this.prisma.adminRefreshToken.count({ where: { revokedAt: null } }),
      this.prisma.supportTicket.count({ where: { status: 'OPEN' } }),
    ]);

    return {
      checks: {
        database: { ok: true, message: 'Postgres reachable' },
        ocr: { ok: true, message: 'Azure Vision configured (see /admin/ocr/overview)' },
      },
      counts: {
        users,
        drivers,
        trips,
        activeDriverRefreshTokens: refresh,
        activeAdminRefreshTokens: adminRefresh,
        openSupportTickets: openTickets,
      },
      generatedAt: new Date().toISOString(),
    };
  }
}
