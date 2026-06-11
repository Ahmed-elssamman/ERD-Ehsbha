import tseslint from '@typescript-eslint/eslint-plugin';
import tsparser from '@typescript-eslint/parser';
import globals from 'globals';

export default [
  {
    ignores: [
      '**/dist/**',
      '**/dev-dist/**',
      '**/coverage/**',
      '**/node_modules/**',
      '**/verification-output/**',
      '**/*.d.ts',
      '**/eslint.config.mjs',
    ],
  },
  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser: tsparser,
      parserOptions: {
        ecmaVersion: 'latest',
        sourceType: 'module',
      },
    },
    plugins: {
      '@typescript-eslint': tseslint,
    },
    rules: {
      ...tseslint.configs.recommended.rules,
      '@typescript-eslint/no-unused-vars': ['warn', { argsIgnorePattern: '^_', varsIgnorePattern: '^_' }],
      '@typescript-eslint/no-explicit-any': 'warn',
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['**/*.tsx', '**/*.ts'],
    plugins: {
      'react-hooks': {
        rules: {
          'exhaustive-deps': 'off',
        },
      },
    },
    rules: {
      'react-hooks/exhaustive-deps': 'off',
    },
  },
  {
    files: ['**/*.mjs', '**/*.cjs', '**/*.js'],
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
    rules: {
      'no-undef': 'error',
      'no-unused-vars': ['warn', { argsIgnorePattern: '^_' }],
    },
  },
  {
    files: ['apps/api/src/modules/ocr/__fixtures__/**'],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
    },
  },
  {
    files: [
      'apps/api/test-fixtures/**',
      'apps/api/prisma/**',
      'scripts/**',
    ],
    rules: {
      '@typescript-eslint/no-unused-vars': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
];
