import js from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettier from 'eslint-config-prettier';
import globals from 'globals';

export default tseslint.config(
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/coverage/**',
      '**/playwright-report/**',
      '**/test-results/**',
      '**/.git/**',
      '**/.vscode/**',
      '**/.doc/**',
      '**/.artifacts/**',
      '**/.verification/**',
      '**/.compiled/**',
      '**/.cache/**',
      '**/.vite/**',
      '**/data/**',
      '**/imports/**',
      '**/exports/**',
      '**/backups/**',
      '**/reports/**',
    ],
  },
  js.configs.recommended,
  tseslint.configs.recommended,
  {
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: [
      'apps/api/**/*.{js,mjs,cjs,ts}',
      'scripts/**/*.{js,mjs,cjs}',
      '**/*.config.{js,mjs,cjs,ts}',
    ],
    languageOptions: { globals: globals.node },
  },
  {
    files: ['apps/web/src/**/*.{js,ts}'],
    languageOptions: { globals: globals.browser },
  },
  {
    files: ['apps/web/test/**/*.ts', 'apps/web/e2e/**/*.ts'],
    languageOptions: { globals: { ...globals.node, ...globals.browser } },
  },
  prettier,
);
