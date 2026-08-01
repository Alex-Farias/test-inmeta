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
//
// `docs` dispensa escopo, e os demais tipos não. `scope-empty` do
// `config-conventional` é global — não sabe distinguir tipo —, então ela é
// desligada e substituída pela regra local abaixo. Sem isso, `docs: audita
// rastreabilidade...` (TASK-074) e `docs: adiciona readme...` (TASK-075) seriam
// rejeitados, apesar de a sequência de referência de `convencoes.md` documentar
// exatamente essa forma. Mesma classe do `fix(infra)` de `756c13f`: a regra
// recusava mensagem que a convenção permite.
module.exports = {
  extends: ['@commitlint/config-conventional'],
  plugins: [
    {
      rules: {
        'escopo-salvo-em-docs': ({ type, scope }) => [
          type === 'docs' || Boolean(scope),
          'escopo e obrigatorio (= modulo) em todo tipo exceto `docs`. Ver convencoes.md.',
        ],
      },
    },
  ],
  rules: {
    // Desligada em favor da regra local — ver o comentario acima.
    'scope-empty': [0],
    'escopo-salvo-em-docs': [2, 'always'],
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
  },
};
