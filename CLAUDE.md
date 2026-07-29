# API de Documentação de Colaboradores

Nest.js · TypeScript · PostgreSQL · TypeORM. Teste técnico avaliado por engenheiros —
o critério é julgamento técnico e código pronto para produção, não volume de features.

## Fluxo de trabalho

Este projeto é conduzido por specs. **A skill `spec-flow` governa o processo** — fases,
portões, decomposição em tasks e checklists de revisão vivem lá, não aqui.

- `specs/requirements.md` · o quê (critérios em EARS)
- `specs/design.md` · como (modelagem, arquitetura, decisões `D-##`)
- `specs/tasks.md` · em que ordem (arquivo vivo, atualizado a cada commit)
- `stack.md` · escolhas de tecnologia e justificativa

Nenhum código sem uma task correspondente em `specs/tasks.md`.
Decisão não coberta por `design.md`: pare e pergunte, não decida no meio do código.

## Comandos

```bash
docker compose up -d                          # sobe o Postgres
npm run migration:run                         # aplica migrations
npm run migration:create -- src/database/migrations/<Nome>   # migration manual
npm test -- <arquivo.spec.ts>                 # roda um único arquivo de teste
npm run test:integration                      # integração (sobe Testcontainers)
npm run test:e2e                              # Playwright, exige o compose no ar
```

`migration:generate` **não** gera índices parciais nem constraints com `WHERE`.
Esses casos exigem `migration:create` e SQL escrito à mão.

## Invariantes

Valem em toda tarefa, sem exceção:

- **Nunca deletar fisicamente.** Soft delete via `deleted_at`. Sem `DELETE FROM`, sem
  `.remove()`.
- **Todo JOIN manual repete `AND <alias>.deleted_at IS NULL`.** O filtro automático do
  `@DeleteDateColumn` cobre apenas o alias principal do QueryBuilder. É por aqui que o
  requisito de soft delete vaza silenciosamente.
- **Escrita múltipla relacionada passa pelo `TransactionRunner`.** Repositórios recebem
  `EntityManager` opcional e usam o transacional quando fornecido.
- **Agregação sempre em SQL.** Nunca carregar coleção em memória para reduzir no Node.
  Toda divisão usa `NULLIF` no denominador.
- **`synchronize: false` sempre**, inclusive em dev. Schema muda só por migration.
- **Erros herdam de `DomainError`.** Controllers nunca lançam `HttpException`; a tradução
  para HTTP é responsabilidade do exception filter global.
- **Módulos se comunicam por services públicos**, nunca por repositórios alheios.
  `statistics` é a exceção declarada, por ser leitura agregada.
- **`employee-documents` é dono do vínculo e das submissions.** Nada fora dele cria
  submission. O limite transacional é o limite do agregado.

## Commits

Conventional Commits, escopo = módulo. Uma task = um commit que compila e passa os testes.
Detalhes e sequência de referência em `.claude/skills/spec-flow/references/convencoes.md`.

Nunca incluir `Co-Authored-By`, "Generated with" ou qualquer trailer de atribuição.
Nunca `--amend`, `push --force` ou rebase em commits já enviados — o histórico é entregável.

## Nunca commitar

`docs/desafio.md` (enunciado do desafio, material de terceiros) · `.env` · dumps de banco.

**`.claude/` É versionado** — a skill `spec-flow` faz parte da entrega e mostra como o
trabalho foi conduzido. Modelos padrão de `.gitignore` excluem dotfiles de ferramenta; este
não pode. Conferir com `git status` que o diretório aparece rastreado.