import js from '@eslint/js'
import globals from 'globals'
import tseslint from 'typescript-eslint'
import reactHooks from 'eslint-plugin-react-hooks'

export default tseslint.config(
  { ignores: ['dist', 'dev-dist', 'prototype', 'supabase/functions', 'node_modules'] },
  {
    files: ['**/*.{ts,tsx}'],
    extends: [js.configs.recommended, ...tseslint.configs.strict],
    languageOptions: { ecmaVersion: 2022, globals: { ...globals.browser, ...globals.serviceworker } },
    plugins: { 'react-hooks': reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      '@typescript-eslint/no-explicit-any': 'error',
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
)
