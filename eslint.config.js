import js from '@eslint/js';
import tseslint from 'typescript-eslint';

export default [
  {
    ignores: [
      'assets/**',
      'src/**',
      'src-v2/**',
      'versions/**',
      'node_modules/**',
      'apps/web/dist/**',
      '.generated/**',
      'playwright-report*/**',
      'test-results*/**',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    files: ['apps/**/*.{ts,tsx}', 'packages/**/*.{ts,tsx}', 'fixtures/**/*.ts', 'scripts/global/**/*.ts', 'tests/global/**/*.ts', '*.config.ts'],
    rules: {
      'no-undef': 'off',
      '@typescript-eslint/consistent-type-imports': 'error',
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { 'argsIgnorePattern': '^_', 'varsIgnorePattern': '^_' }],
    },
  },
];
