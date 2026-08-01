// @ts-check
import eslint from '@eslint/js';
import tseslint from 'typescript-eslint';
import prettierRecommended from 'eslint-plugin-prettier/recommended';

export default tseslint.config(
  {
    ignores: [
      'dist/**',
      'node_modules/**',
      'coverage/**',
      'eslint.config.mjs',
      'commitlint.config.js',
    ],
  },
  eslint.configs.recommended,
  ...tseslint.configs.recommendedTypeChecked,
  prettierRecommended,
  {
    languageOptions: {
      parserOptions: {
        projectService: true,
        tsconfigRootDir: import.meta.dirname,
      },
    },
    rules: {
      '@typescript-eslint/interface-name-prefix': 'off',
      '@typescript-eslint/explicit-function-return-type': 'off',
      '@typescript-eslint/explicit-module-boundary-types': 'off',
      '@typescript-eslint/no-explicit-any': 'error',

      // Invariante do projeto: nunca deletar fisicamente (REQ-14.1, TASK-063).
      // Preventiva, nao detectiva — roda a cada commit e impede a introducao,
      // em vez de encontrar o que ja foi escrito.
      'no-restricted-syntax': [
        'error',
        {
          selector: "CallExpression > MemberExpression[property.name=/^(remove|softRemove)$/]",
          message:
            'Remocao fisica proibida. Use soft delete via deleted_at (@DeleteDateColumn). Ver CLAUDE.md, Invariantes.',
        },
        {
          selector: "Literal[value=/DELETE\\s+FROM/i]",
          message:
            'DELETE FROM proibido. Use soft delete via deleted_at. Ver CLAUDE.md, Invariantes.',
        },
        {
          selector: "TemplateElement[value.raw=/DELETE\\s+FROM/i]",
          message:
            'DELETE FROM proibido. Use soft delete via deleted_at. Ver CLAUDE.md, Invariantes.',
        },
      ],
    },
  },
);
