/** @type {import('dependency-cruiser').IConfiguration} */
module.exports = {
  forbidden: [
    {
      name: 'no-web-to-admin',
      comment: 'apps/web must not import from apps/admin',
      severity: 'error',
      from: { path: '^apps/web/' },
      to: { path: '^apps/admin/' },
    },
    {
      name: 'no-admin-to-web',
      comment: 'apps/admin must not import from apps/web',
      severity: 'error',
      from: { path: '^apps/admin/' },
      to: { path: '^apps/web/' },
    },
    {
      name: 'no-frontend-to-api',
      comment: 'Frontend apps must not import from apps/api',
      severity: 'error',
      from: { path: '^(apps/web|apps/admin)/' },
      to: { path: '^apps/api/' },
    },
    {
      name: 'no-frontend-server-imports',
      comment: 'Frontend must not import server-only modules',
      severity: 'error',
      from: { path: '^(apps/web|apps/admin)/' },
      to: { path: '^(node_modules/@prisma|node_modules/@nestjs)/' },
    },
    {
      name: 'no-shared-package-framework-imports',
      comment: 'Shared packages must not import frameworks',
      severity: 'error',
      from: { path: '^packages/(shared-types|api-contracts|ui-tokens)/' },
      to: { path: '^(node_modules/(react|@nestjs|@prisma|axios)/)|^(apps/)' },
    },
    {
      name: 'no-cycles',
      comment: 'No dependency cycles allowed',
      severity: 'error',
      from: {},
      to: { circular: true },
    },

  ],
  options: {
    doNotFollow: 'node_modules',
    exclude: {
      path: ['node_modules', 'dist', 'build', 'coverage', 'verification-output'],
    },
    includeOnly: '^(apps|packages)',
    tsPreCompilationDeps: true,
    tsConfig: {
      fileName: 'tsconfig.json',
    },
  },
}
