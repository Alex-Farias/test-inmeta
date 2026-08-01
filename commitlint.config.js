// TASK-072. Estende o parser padrao `type(scope): assunto` de
// `@commitlint/config-conventional` e sobrescreve só o que
// `.claude/skills/spec-flow/references/convencoes.md` restringe além do
// genérico: tipos e escopos fechados nos sete/oito deste projeto — não o
// conjunto default do conventional-commits, que inclui coisas como
// `style`/`ci`/`build` que este projeto não usa.
//
// "minúscula, sem ponto final" e o teto de 100 caracteres já vêm certos do
// próprio `config-conventional` — não redeclarados aqui. `subject-case`
// default é `['never', ['sentence-case', 'start-case', 'pascal-case',
// 'upper-case']]`, não `['always', 'lower-case']`: a diferença importa de
// verdade, porque este projeto referencia `TASK-###` no meio de assunto em
// minúscula o tempo todo (ex.: "marca TASK-072 concluida em tasks.md"), e um
// `lower-case` estrito rejeitaria exatamente esse padrão — decisão inicial
// errada, encontrada ao tentar commitar a marcação desta própria task.
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
  },
};
