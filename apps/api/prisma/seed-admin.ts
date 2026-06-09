/**
 * Standalone admin seed. Idempotent — safe to run multiple times.
 *
 *   npm --workspace @ehsbha/api run prisma:seed:admin
 *
 * Seeds:
 *   - Permission catalog (scope.action rows)
 *   - 5 system roles (super_admin, admin, moderator, support, analyst)
 *   - Role → permission links
 *   - 5 demo admin accounts (see ADMIN_ARCHITECTURE.md Step 2)
 */
import { PrismaClient } from '@prisma/client';
import * as argon2 from 'argon2';

const prisma = new PrismaClient();

const PERMISSIONS: Array<{ scope: string; action: string; description?: string }> = [
  { scope: 'dashboard', action: 'read' },
  { scope: 'users', action: 'read' },
  { scope: 'users', action: 'update' },
  { scope: 'users', action: 'suspend' },
  { scope: 'users', action: 'activate' },
  { scope: 'users', action: 'blacklist' },
  { scope: 'users', action: 'restore' },
  { scope: 'users', action: 'delete' },
  { scope: 'users', action: 'impersonate' },
  { scope: 'users', action: 'export' },
  { scope: 'drivers', action: 'read' },
  { scope: 'drivers', action: 'update' },
  { scope: 'drivers', action: 'suspend' },
  { scope: 'drivers', action: 'activate' },
  { scope: 'drivers', action: 'blacklist' },
  { scope: 'drivers', action: 'restore' },
  { scope: 'drivers', action: 'recalc_score' },
  { scope: 'trips', action: 'read' },
  { scope: 'trips', action: 'update' },
  { scope: 'trips', action: 'delete' },
  { scope: 'trips', action: 'restore' },
  { scope: 'trips', action: 'bulk_export' },
  { scope: 'vehicles', action: 'read' },
  { scope: 'vehicles', action: 'update' },
  { scope: 'vehicles', action: 'delete' },
  { scope: 'ocr', action: 'read' },
  { scope: 'ocr', action: 'replay' },
  { scope: 'ocr', action: 'tune' },
  { scope: 'community', action: 'read' },
  { scope: 'community', action: 'hide' },
  { scope: 'community', action: 'unhide' },
  { scope: 'community', action: 'feature' },
  { scope: 'community', action: 'unfeature' },
  { scope: 'community', action: 'delete' },
  { scope: 'community', action: 'restore' },
  { scope: 'reviews', action: 'read' },
  { scope: 'reviews', action: 'approve' },
  { scope: 'reviews', action: 'unapprove' },
  { scope: 'reviews', action: 'feature' },
  { scope: 'reviews', action: 'unfeature' },
  { scope: 'reviews', action: 'delete' },
  { scope: 'support', action: 'read' },
  { scope: 'support', action: 'assign' },
  { scope: 'support', action: 'reply' },
  { scope: 'support', action: 'transition' },
  { scope: 'support', action: 'close' },
  { scope: 'notifications', action: 'read' },
  { scope: 'notifications', action: 'compose' },
  { scope: 'notifications', action: 'broadcast' },
  { scope: 'revenue', action: 'read' },
  { scope: 'revenue', action: 'export' },
  { scope: 'analytics', action: 'read' },
  { scope: 'analytics', action: 'export' },
  { scope: 'audit', action: 'read' },
  { scope: 'audit', action: 'export' },
  { scope: 'roles', action: 'read' },
  { scope: 'roles', action: 'manage' },
  { scope: 'settings', action: 'read' },
  { scope: 'settings', action: 'update' },
  { scope: 'platform_health', action: 'read' },
  { scope: 'feature_usage', action: 'read' },
];

// Permission codes (scope.action) granted to each system role.
// super_admin gets all permissions (and also receives the '*' wildcard at JWT issuance).
const ROLE_PERMISSIONS: Record<string, string[]> = {
  super_admin: PERMISSIONS.map((p) => `${p.scope}.${p.action}`),
  admin: [
    'dashboard.read',
    'users.read', 'users.update', 'users.suspend', 'users.activate', 'users.blacklist', 'users.restore', 'users.impersonate', 'users.export',
    'drivers.read', 'drivers.update', 'drivers.suspend', 'drivers.activate', 'drivers.blacklist', 'drivers.restore', 'drivers.recalc_score',
    'trips.read', 'trips.update', 'trips.delete', 'trips.restore', 'trips.bulk_export',
    'vehicles.read', 'vehicles.update', 'vehicles.delete',
    'ocr.read', 'ocr.replay', 'ocr.tune',
    'community.read', 'community.hide', 'community.unhide', 'community.feature', 'community.unfeature', 'community.restore',
    'reviews.read', 'reviews.approve', 'reviews.unapprove', 'reviews.feature', 'reviews.unfeature',
    'support.read', 'support.assign', 'support.reply', 'support.transition', 'support.close',
    'notifications.read', 'notifications.compose', 'notifications.broadcast',
    'revenue.read', 'revenue.export',
    'analytics.read', 'analytics.export',
    'audit.read', 'audit.export',
    'roles.read',
    'settings.read',
    'platform_health.read',
    'feature_usage.read',
  ],
  moderator: [
    'dashboard.read',
    'users.read',
    'drivers.read',
    'community.read', 'community.hide', 'community.unhide', 'community.feature', 'community.unfeature', 'community.restore',
    'reviews.read', 'reviews.approve', 'reviews.unapprove', 'reviews.feature', 'reviews.unfeature',
    'audit.read',
  ],
  support: [
    'dashboard.read',
    'users.read', 'users.update',
    'drivers.read',
    'trips.read',
    'support.read', 'support.assign', 'support.reply', 'support.transition', 'support.close',
    'notifications.read', 'notifications.compose',
    'audit.read',
  ],
  analyst: [
    'dashboard.read',
    'users.read',
    'drivers.read',
    'trips.read',
    'vehicles.read',
    'community.read',
    'reviews.read',
    'revenue.read', 'revenue.export',
    'analytics.read', 'analytics.export',
    'feature_usage.read',
    'platform_health.read',
    'audit.read',
  ],
};

const ROLES: Array<{ code: string; name: string; description: string }> = [
  { code: 'super_admin', name: 'Super Admin', description: 'Ultimate platform owner. Manages admins, roles, billing.' },
  { code: 'admin', name: 'Admin', description: 'Day-to-day platform management.' },
  { code: 'moderator', name: 'Moderator', description: 'Community and review moderation.' },
  { code: 'support', name: 'Support Agent', description: 'Handles support tickets.' },
  { code: 'analyst', name: 'Analyst', description: 'Read-only across all analytics.' },
];

const DEMO_ACCOUNTS: Array<{ email: string; displayName: string; roleCode: string }> = [
  { email: 'admin@ehsbha.com',     displayName: 'Super Admin', roleCode: 'super_admin' },
  { email: 'manager@ehsbha.com',   displayName: 'Manager',     roleCode: 'admin' },
  { email: 'moderator@ehsbha.com', displayName: 'Moderator',   roleCode: 'moderator' },
  { email: 'support@ehsbha.com',   displayName: 'Support',     roleCode: 'support' },
  { email: 'analyst@ehsbha.com',   displayName: 'Analyst',     roleCode: 'analyst' },
];

async function main(): Promise<void> {
  const adminSeedPassword = process.env.ADMIN_SEED_PASSWORD;
  if (!adminSeedPassword) {
    throw new Error('ADMIN_SEED_PASSWORD is required for deterministic non-production seeding');
  }
  console.log('[admin-seed] Upserting permissions…');
  for (const p of PERMISSIONS) {
    await prisma.adminPermission.upsert({
      where: { scope_action: { scope: p.scope, action: p.action } },
      update: { description: p.description ?? null },
      create: { scope: p.scope, action: p.action, description: p.description ?? null },
    });
  }

  console.log('[admin-seed] Upserting roles…');
  for (const r of ROLES) {
    await prisma.adminRole.upsert({
      where: { code: r.code },
      update: { name: r.name, description: r.description, isSystem: true },
      create: { code: r.code, name: r.name, description: r.description, isSystem: true },
    });
  }

  console.log('[admin-seed] Linking permissions to roles…');
  for (const [roleCode, permCodes] of Object.entries(ROLE_PERMISSIONS)) {
    const role = await prisma.adminRole.findUniqueOrThrow({ where: { code: roleCode } });
    // Clear and replace links (idempotent).
    await prisma.adminRolePermission.deleteMany({ where: { roleId: role.id } });
    for (const code of permCodes) {
      const [scope, action] = code.split('.');
      const perm = await prisma.adminPermission.findUnique({
        where: { scope_action: { scope, action } },
      });
      if (perm) {
        await prisma.adminRolePermission.create({
          data: { roleId: role.id, permissionId: perm.id },
        });
      }
    }
  }

  console.log('[admin-seed] Upserting demo admin accounts…');
  for (const acct of DEMO_ACCOUNTS) {
    const role = await prisma.adminRole.findUniqueOrThrow({ where: { code: acct.roleCode } });
    const passwordHash = await argon2.hash(adminSeedPassword, { type: argon2.argon2id });
    const admin = await prisma.adminUser.upsert({
      where: { email: acct.email },
      update: { displayName: acct.displayName, isActive: true, passwordHash },
      create: {
        email: acct.email,
        passwordHash,
        displayName: acct.displayName,
        isActive: true,
      },
    });
    await prisma.adminUserRole.upsert({
      where: { adminUserId_roleId: { adminUserId: admin.id, roleId: role.id } },
      update: {},
      create: { adminUserId: admin.id, roleId: role.id },
    });
    console.log(`  ✓ ${acct.email} (${acct.roleCode})`);
  }

  console.log('[admin-seed] Done.');
}

main()
  .catch((err) => {
    console.error('[admin-seed] Failed:', err);
    process.exit(1);
  })
  .finally(() => {
    void prisma.$disconnect();
  });
