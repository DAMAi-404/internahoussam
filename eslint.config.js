import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'
import { defineConfig } from 'eslint/config'

export default defineConfig(
  { ignores: ['dist', 'dev-dist', 'prototype', 'supabase/functions', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict, reactHooks.configs.flat['recommended-latest']],
    languageOptions: { ecmaVersion: 2023, globals: { ...globals.browser, ...globals.serviceworker } },
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_', ignoreRestSiblings: true }],
      // RTL: physical Tailwind spacing/position classes are banned (CLAUDE.md > UI).
      'no-restricted-syntax': [
        'error',
        {
          selector: 'Literal[value=/(^|\\s)-?(ml|mr|pl|pr|left|right)-[^\\s]+|(^|\\s)text-(left|right)(\\s|$)/]',
          message: 'Use logical utilities (ms-/me-/ps-/pe-/start-/end-/text-start/text-end) so RTL works.',
        },
      ],
    },
  },
  {
    // Tests may assert presence with `!` after checking it.
    files: ['**/*.test.ts', 'src/dev/**'],
    rules: { '@typescript-eslint/no-non-null-assertion': 'off' },
  },
)
