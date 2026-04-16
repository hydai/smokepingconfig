import js from '@eslint/js';
import globals from 'globals';

export default [
  js.configs.recommended,
  {
    ignores: ['packages/web/build/**', 'packages/web/.svelte-kit/**', 'node_modules/**'],
  },
  {
    languageOptions: {
      globals: {
        ...globals.node,
      },
    },
  },
];
