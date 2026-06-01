/**
 * Shared lint base for the Ehsbha monorepo.
 *
 * The single most important rule here is the cross-app import ban:
 * apps/admin and apps/web must never import from each other. They may
 * only share code via the packages/* tree.
 */
export const crossAppImportRule = {
  rules: {
    'no-restricted-imports': [
      'error',
      {
        patterns: [
          {
            group: ['**/apps/web/**', '@ehsbha/web/**'],
            message: 'apps/admin must not import from apps/web. Lift shared code into packages/*.',
          },
          {
            group: ['**/apps/admin/**', '@ehsbha/admin/**'],
            message: 'apps/web must not import from apps/admin. Lift shared code into packages/*.',
          },
        ],
      },
    ],
  },
};

export default crossAppImportRule;
