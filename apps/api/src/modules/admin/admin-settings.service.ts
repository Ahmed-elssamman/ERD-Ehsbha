import { Injectable } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../../prisma/prisma.service';
import { AdminAuditService } from './audit.service';
import type { AuthenticatedAdmin } from './admin.types';

interface SettingDef {
  key: string;
  description: string;
  defaultValue: Prisma.InputJsonValue;
}

const SETTING_DEFS: SettingDef[] = [
  { key: 'moderation.report_threshold', description: 'Number of reports before a community post is auto-flagged.', defaultValue: 2 },
  { key: 'support.sla_hours', description: 'Default SLA for first response to a support ticket, in hours.', defaultValue: 24 },
  { key: 'ocr.success_threshold', description: 'Minimum mean OCR confidence (0-1) considered a success.', defaultValue: 0.85 },
  { key: 'notifications.email_enabled', description: 'Master switch for outgoing email notifications.', defaultValue: true },
  { key: 'audit.retention_days', description: 'Days to keep audit log rows online before archival.', defaultValue: 730 },
  { key: 'platform.maintenance_mode', description: 'When true, blocks driver app writes and returns 503.', defaultValue: false },
  { key: 'platform.signup_open', description: 'When false, blocks new driver signups.', defaultValue: true },
];

@Injectable()
export class AdminSettingsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly audit: AdminAuditService,
  ) {}

  async list() {
    const rows = await this.prisma.adminSetting.findMany();
    const byKey = new Map(rows.map((r) => [r.key, r]));
    return SETTING_DEFS.map((def) => {
      const r = byKey.get(def.key);
      return {
        key: def.key,
        description: def.description,
        value: r ? r.value : def.defaultValue,
        isDefault: !r,
        updatedAt: r?.updatedAt.toISOString() ?? null,
        updatedById: r?.updatedById ?? null,
      };
    });
  }

  async update(actor: AuthenticatedAdmin, key: string, value: Prisma.InputJsonValue) {
    const def = SETTING_DEFS.find((d) => d.key === key);
    if (!def) {
      // Unknown settings still allowed but tagged as ad-hoc.
    }
    const before = await this.prisma.adminSetting.findUnique({ where: { key } });
    const after = await this.prisma.adminSetting.upsert({
      where: { key },
      create: { key, value, description: def?.description, updatedById: actor.id },
      update: { value, updatedById: actor.id },
    });
    await this.audit.record({
      actor,
      action: 'settings.update',
      targetType: 'AdminSetting',
      targetId: key,
      before: before ? { value: before.value } : null,
      after: { value: after.value },
      reason: `Update setting ${key}`,
    });
    return after;
  }
}
