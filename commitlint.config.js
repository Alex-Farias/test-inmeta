// TASK-072. Estende o parser padrao `type(scope): assunto` de
// `@commitlint/config-conventional` e sobrescreve só o que
// `.claude/skills/spec-flow/references/convencoes.md` restringe além do
// genérico: tipos e escopos fechados (não o conjunto default do
// conventional-commits, que inclui coisas como `style`/`ci`/`build` que este
// projeto não usa), minúscula, sem ponto final.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  rules: {
    'type-enum': [2, 'always', ['feat', 'fix', 'refactor', 'test', 'chore', 'docs', 'perf']],
    'scope-enum': [
      2,
      'always',
      [
        'employees',
        'document-types',
        'employee-documents',
        'submissions',
        'statistics',
        'shared',
        'db',
        'infra',
      ],
    ],
    'scope-empty': [2, 'never'],
    'subject-case': [2, 'always', 'lower-case'],
    'subject-full-stop': [2, 'never', '.'],
    // Maior linha de assunto já commitada tem 93 caracteres — o teto default
    // do commitlint (72) já rejeitaria histórico real deste projeto.
    'header-max-length': [2, 'always', 100],
  },
};
