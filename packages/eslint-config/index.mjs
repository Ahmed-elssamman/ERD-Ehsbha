export default [
  {
    files: ['apps/web/**/*.{ts,tsx}', 'apps/admin/**/*.{ts,tsx}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['apps/web/*', 'apps/web/**'],
              message: 'apps/web may not import from other applications',
            },
            {
              group: ['apps/admin/*', 'apps/admin/**'],
              message: 'apps/admin may not import from other applications',
            },
            {
              group: ['apps/api/*', 'apps/api/**'],
              message: 'Frontend applications must not import from apps/api',
            },
            {
              group: ['@prisma/client', '@nestjs/*', 'apps/api/prisma/*'],
              message: 'Frontend applications must not import server-only packages',
            },
          ],
        },
      ],
    },
  },
]
