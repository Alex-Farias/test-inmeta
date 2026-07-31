# Tasks

Em **que ordem**. Arquivo vivo: atualizado a cada commit.

- O **que** está em `specs/requirements.md` (`REQ-##`).
- O **como** está em `specs/design.md` (`D-##`).
- Convenção de commit e checklist de autorrevisão em
  `.claude/skills/spec-flow/references/convencoes.md`.

Níveis conforme a tabela do `SKILL.md`: **P0** critério de avaliação declarado, nunca
cortado · **P1** escopo funcional obrigatório · **P2** diferencial declarado ·
**P3** melhoria opcional.

**74 tasks ativas** — P0 35 · P1 31 · P2 6 · P3 2 — mais quatro marcadores `[>]`
(TASK-016, 023, 029, 036). Nenhum `[~]`: nada foi descartado ainda.

Corte começa em P3 e sobe, **respeitando o fecho transitivo abaixo** — não a coluna de nível.

### Mapeamento origem → nível

O nível de uma task é derivado da **origem do requisito que ela atende**, registrada no índice
de `specs/requirements.md`. Isso existe porque os dois vocabulários divergiam: nada ligava
"Diferencial" a P2, e o resultado era nível atribuído por intuição.

| Origem em `requirements.md` | Nível |
|---|---|
| Enunciado (avaliado) | P0 |
| Enunciado | P1 |
| Enunciado (transversal) | P1, salvo se também Avaliado |
| Escolha nossa / Decisão `D-##` | nível do requisito que a motiva |
| Fundação | P1 — executa primeiro pela exceção do `SKILL.md`, o que é ordem, não nível |
| Diferencial | P2 |
| Entrega / fechamento | P0 — README e varredura final são entregáveis avaliados |
| Sem requisito | P3 |

Task que atende mais de um requisito recebe o **maior** nível entre eles. Exceção a essa regra
é declarada na própria linha da task, com o motivo.

### Corte é transitivo

Cortar uma task implica cortar **todas** que dependem dela. O nível indica peso de avaliação,
não cortabilidade isolada: uma task P1 ou P2 com dependentes P0 é, na prática, inegociável. A
ordem de corte real é o fecho transitivo, não a coluna de nível.

### O que dá para cortar

Esta é a lista que se consulta sob pressão de prazo: as tasks **sem nenhum dependente P0**,
que podem sair sem derrubar critério de avaliação. São **13 de 74**.

**P3 — corte primeiro (2)**

| Task | Módulo | Título |
|---|---|---|
| TASK-071 | `db` | adiciona seeds de demonstracao |
| TASK-072 | `infra` | adiciona commitlint |

**P2 — corte em seguida (6)**

| Task | Módulo | Título |
|---|---|---|
| TASK-064 | `shared` | adiciona health check com verificacao do banco |
| TASK-065 | `shared` | adiciona logs estruturados com request id correlacionado |
| TASK-066 | `shared` | omite dado pessoal dos registros de execucao |
| TASK-067 | `shared` | habilita log legivel fora de producao |
| TASK-068 | `infra` | adiciona documentacao openapi |
| TASK-069 | `infra` | adiciona suite e2e do fluxo completo |

Cortar TASK-065 leva junto TASK-066 e TASK-067, que dependem dela — os três diferenciais de
log caem como bloco ou ficam como bloco.

**P1 — último recurso, e cada uma custa escopo funcional (5)**

| Task | Módulo | Título |
|---|---|---|
| TASK-028 | `employee-documents` | rejeita lote invalido ou com vinculo duplicado |
| TASK-049 | `employee-documents` | adiciona filtros de pendentes por colaborador e tipo |
| TASK-050 | `employee-documents` | retorna vazio para filtro com registro removido |
| TASK-055 | `statistics` | retorna valor definido para base vazia |
| TASK-070 | `db` | valida plano de consulta dos pendentes com explain |

TASK-049 leva junto TASK-050. E cortar TASK-049 elimina os filtros que REQ-10.2 a REQ-10.4
exigem — é escopo funcional declarado saindo, não polimento.

**As 61 restantes são inegociáveis**: ou são P0, ou têm dependente P0. Note que outras 13
tasks P0 também não têm dependente nenhum (TASK-008, 018, 019, 027, 042, 043, 047, 051, 052,
059, 060, 061, 076) — ser folha não as torna cortáveis, porque P0 é critério de avaliação
declarado.

### Apêndice — cabeças de cadeia

O complemento da lista acima: **26 tasks P1 têm dependentes P0**, e nenhuma P2 tem. TASK-078 é
o caso mais claro — é P1 e sustenta a suíte de integração de que quase toda P0 depende para
provar seu critério; com **28 dependentes P0**, cortá-la deixaria quase toda a entrega sem
como ser verificada.

| Task | Dependentes P0 | Total |
|---|---|---|
| TASK-001 | 34 | 72 |
| TASK-078 | 28 | 59 |
| TASK-002 | 28 | 58 |
| TASK-003 | 28 | 58 |
| TASK-004 | 28 | 57 |
| TASK-012 | 26 | 50 |
| TASK-020 | 24 | 47 |
| TASK-025 | 23 | 43 |
| TASK-037 | 18 | 33 |
| TASK-038 | 18 | 32 |

---

## Ordem de execução e suas três exceções

A regra é fundação primeiro, depois **P0 de um módulo antes de P1 de outro**. Ela é seguida,
com três quebras forçadas por dependência real, declaradas aqui em vez de silenciadas:

1. **A propagação de remoção (P0) vem depois da vinculação em lote (P1).** Não há como
   propagar remoção para vínculos antes de o vínculo existir. TASK-031 a TASK-034 dependem
   de TASK-025.
2. **Os testes que atravessam o sistema inteiro vêm por último.** TASK-061 prova que a cascata
   de remoção de tipo preserva submissions, e TASK-073 percorre o checklist completo — ambos
   exigem o sistema montado. Note que a *regra de lint* que proíbe remoção física (TASK-063)
   **não** está aqui: ela é preventiva e vive na fundação, porque lint no fim detecta o que já
   foi escrito em vez de impedir que se escreva.

3. **As tasks de Fechamento (P0) vêm depois de todas as P2 e P3.** TASK-073 a TASK-076
   auditam, documentam e validam o que já existe: não se escreve o README antes do código nem
   se valida clone limpo antes de haver o que clonar. É a maior inversão de nível do arquivo,
   e é inevitável.

Nos três casos a dependência é real, não conveniência. Onde não há dependência, P0 precede: o
soft delete de colaborador (TASK-017) vem antes de qualquer task de `document-types`, e a
remoção de tipo (TASK-024) antes de qualquer task de vínculo.

**Sobre a migration inicial.** `spec-standard.md` determina que a migration acompanhe a
entidade que a exige, na mesma task. Isso diverge da sequência ilustrativa de
`convencoes.md`, que sugere um único `feat(db): cria migration inicial das quatro tabelas`.
Sigo a regra de decomposição, não a ilustração: quatro migrations, cada uma no commit da sua
entidade, mantém qualquer checkout do meio compilando. O motivo da regra é exatamente esse.

**Sobre o escopo `submissions`.** `employee-documents` é dono do agregado (D-10), mas
`convencoes.md` lista `submissions` como escopo de commit próprio. Uso `submissions` nas
tasks de envio para manter o histórico legível, sem que isso implique módulo Nest separado —
o código vive em `modules/employee-documents/`.

---

## Fundação

Precede tudo (exceção declarada no `SKILL.md`). Sem `TransactionRunner` e hierarquia de
erros, as tasks P0 nascem tortas.

**TASK-063, TASK-077 e TASK-078 executam por dependência declarada, não por ordem numérica.**
Os IDs foram preservados para não quebrar referências; a posição na seção é que define quando
rodam.

- [x] **TASK-077** · P0 · `infra` · inicializa repositorio git com gitignore e atribuicao vazia
  - Origem: Entrega / fechamento — sem `REQ`, ver "Restrições de entrega" em
    `requirements.md`
  - Depende de: —
  - Aceite: `git init` feito; `.gitignore` cobre `node_modules`, `.env`, dumps de banco e
    `docs/desafio.md`, e **não** exclui `.claude/` — a skill `spec-flow` é parte do
    repositório e modelos padrão de `.gitignore` a apagariam; `.claude/settings.json` define
    `attribution.commit` e `attribution.pr` vazios
  - Teste: verificação manual — `git status` mostra `.claude/` rastreado, e
    `git log -1 --format=%B` não traz trailer de atribuição
  - Commit: `chore(infra)` · `a623458`
  - **Exceção declarada — dois commits nesta task.** `git init` cria repositório vazio, e
    havia oito arquivos já no disco (specs, `CLAUDE.md`, `stack.md`, a skill). Um commit único
    com o título desta task descreveria 20% do próprio diff. Ficou `a623458`
    (`.gitignore` + `settings.json`) e `docs: adiciona specs aprovadas e skill do fluxo`. O
    `.gitignore` precisava existir antes do segundo, senão `docs/desafio.md` entraria no
    histórico e não sairia mais.

- [x] **TASK-001** · P1 · `infra` · inicializa projeto nest com typescript e eslint
  - Requisitos: REQ-00
  - Depende de: TASK-077
  - Aceite: `npm run build` compila e `npm run lint` passa em base limpa
  - Teste: verificação manual documentada no README
  - Commit: `chore(infra)` · `af02634`

- [x] **TASK-063** · P0 · `infra` · proibe remocao fisica por regra de lint
  - Requisitos: REQ-14.1
  - Depende de: TASK-001
  - **Posição:** preventiva. Precisa existir **antes** da primeira linha de domínio — lint
    colocado no fim detecta o que já foi escrito em vez de impedir que se escreva.
  - Aceite: `no-restricted-syntax` rejeita chamada a `.remove()` / `.softRemove()` sobre
    repositório e literal casando `/DELETE\s+FROM/i`; `npm run lint` falha ao introduzir
    qualquer das duas
  - Teste: verificação por lint — a regra é o próprio teste, executada a cada commit
  - Commit: `chore(infra)` · `fb78d18`

- [x] **TASK-078** · P1 · `infra` · separa suites de teste unitaria e de integracao
  - Requisitos: REQ-00
  - Depende de: TASK-001
  - Aceite: `npm test` roda só unitários; `npm run test:integration` usa projeto Jest próprio,
    sem colidir com a suíte unitária
  - Teste: verificação manual documentada no README
  - Commit: `chore(infra)` · `8592095`

- [x] **TASK-002** · P1 · `infra` · adiciona docker-compose com postgres 18
  - Requisitos: REQ-00
  - Depende de: TASK-001
  - Aceite: `docker compose up -d` sobe Postgres 18 aceitando conexão na porta configurada
  - Teste: verificação manual documentada no README
  - Commit: `chore(infra)` · `5b2d9fc`

- [x] **TASK-003** · P1 · `infra` · adiciona validacao de variaveis de ambiente
  - Requisitos: REQ-00.3
  - Depende de: TASK-078
  - Aceite: "QUANDO o sistema é iniciado com configuração obrigatória ausente ou inválida, o
    sistema DEVE falhar imediatamente na inicialização, com mensagem que identifique o item
    faltante"
  - Teste: `env.validation.spec.ts` → "falha na inicialização identificando a variável ausente"
  - Commit: `chore(infra)` · `b91c2a1`

- [x] **TASK-004** · P1 · `db` · configura typeorm com data source e migrations
  - Requisitos: REQ-00.4
  - Depende de: TASK-002, TASK-003
  - Aceite: `npm run migration:run` aplica em banco limpo; `synchronize` e `migrationsRun`
    são `false` em toda configuração (D-11)
  - Teste: verificação manual documentada no README
  - Commit: `chore(db)` · `79915b6`
  - **Ressalva do aceite.** Não existe migration alguma neste ponto — a primeira nasce na
    TASK-012. O que `migration:run` provou aqui foi conexão, autenticação e criação da tabela
    de controle `migrations` (`No migrations are pending`, exit 0), não aplicação de
    migration. A parte do aceite que depende de haver migration é exercida pela TASK-012.

- [x] **TASK-005** · P0 · `shared` · adiciona hierarquia de erros de dominio
  - Requisitos: REQ-19.2
  - Depende de: TASK-001
  - Aceite: `DomainError` e as cinco subclasses de D-08 existem, cada uma expondo seu código
  - Teste: `domain-error.spec.ts` → "cada erro de domínio expõe seu código próprio"
  - Commit: `feat(shared)` · `18e2519`

- [x] **TASK-006** · P0 · `shared` · adiciona exception filter global traduzindo erros de dominio
  - Requisitos: REQ-19.1, REQ-19.2
  - Depende de: TASK-005
  - Aceite: "O sistema DEVE responder a toda falha com um formato de erro único e estável,
    qualquer que seja a origem da falha", com o mapeamento de D-08
  - Teste: `exception.filter.spec.ts` → "traduz cada DomainError para seu status HTTP"
  - Commit: `feat(shared)` · `273a5fb`

- [x] **TASK-007** · P0 · `shared` · adiciona request id em toda resposta de erro
  - Requisitos: REQ-19.3
  - Depende de: TASK-006
  - Aceite: "O sistema DEVE incluir em toda resposta de erro um identificador da requisição"
  - Teste: `exception.filter.spec.ts` → "inclui requestId no payload de erro"
  - Commit: `feat(shared)` · `6aafa8a`

- [x] **TASK-008** · P0 · `shared` · responde 500 sem vazar detalhe interno em erro nao mapeado
  - Requisitos: REQ-19.4, REQ-19.5
  - Depende de: TASK-007
  - Aceite: "SE ocorrer falha não prevista, ENTÃO o sistema DEVE responder com erro genérico
    de servidor e registrar internamente o rastreamento completo", sem stack, consulta ou
    nome de tabela na resposta
  - Teste: `exception.filter.spec.ts` → "responde 500 genérico sem expor stack"
  - Commit: `feat(shared)` · `1fc5724`

- [x] **TASK-009** · P0 · `shared` · configura validation pipe global com whitelist
  - Requisitos: REQ-19.6, REQ-19.7
  - Depende de: TASK-006
  - Aceite: "O sistema DEVE rejeitar campos não reconhecidos na entrada, em vez de
    ignorá-los em silêncio" e indicar quais campos foram recusados
  - Teste: `validation.pipe.spec.ts` → "rejeita campo desconhecido nomeando o campo"
  - Commit: `feat(shared)` · `ceaa147`

- [x] **TASK-010** · P0 · `shared` · adiciona transaction runner sobre o data source
  - Requisitos: REQ-15.1
  - Depende de: TASK-004
  - Aceite: `TransactionRunner.run` executa em `READ COMMITTED` e propaga o `EntityManager`
    ao callback, conforme D-05
  - Teste: `transaction-runner.integration.spec.ts` → "desfaz escritas quando o callback lança"
  - Commit: `feat(shared)` · `05d2ee9`

- [x] **TASK-011** · P1 · `shared` · adiciona utilitario de paginacao
  - Requisitos: REQ-11.2, REQ-11.3, REQ-11.4, REQ-11.6
  - Depende de: TASK-009
  - Aceite: aplica padrão documentado, respeita o teto máximo de itens e rejeita valores
    inválidos com erro de validação (D-15)
  - Teste: `pagination.dto.spec.ts` → "aplica padrão, limita ao teto e rejeita valor inválido"
  - Commit: `feat(shared)` · `8e05338`
  - **Números de padrão e teto não estavam fixados em D-15** (só o exemplo `limit=20` em
    §4). Confirmado com o humano: página padrão `1`, `limit` padrão `20`, teto `100`.
    Exceder o teto limita (`clamp`) o valor sem erro (REQ-11.4); valor não numérico, zero
    ou negativo é rejeitado pelo `ValidationPipe` global da TASK-009 (REQ-11.6) — a
    distinção segue os verbos do próprio critério de aceite ("respeita" vs. "rejeita").

---

## Colaboradores

- [x] **TASK-012** · P1 · `employees` · adiciona entidade e migration de colaboradores
  - Requisitos: REQ-01.2
  - Depende de: TASK-004
  - Aceite: migration cria `employees` com `uq_employees_email` parcial (§1.3 do design)
  - Teste: `employees.repository.integration.spec.ts` → "aplica o índice único parcial de e-mail"
  - Commit: `feat(employees)` · `f665135`

- [x] **TASK-013** · P1 · `employees` · adiciona cadastro de colaborador
  - Requisitos: REQ-01.1, REQ-01.3
  - Depende de: TASK-012, TASK-009
  - Aceite: "QUANDO um colaborador é cadastrado com dados válidos, o sistema DEVE registrá-lo
    e devolver sua identificação"; e-mail já pertencente a colaborador ativo é rejeitado com
    conflito
  - Teste: `employees.service.spec.ts` → "rejeita e-mail já usado por colaborador ativo"
  - Commit: `feat(employees)` · `8f37a40`

- [x] **TASK-014** · P1 · `employees` · adiciona listagem paginada de colaboradores
  - Requisitos: REQ-01.6, REQ-11.1, REQ-11.5, REQ-11.7
  - Depende de: TASK-013, TASK-011
  - Aceite: lista apenas ativos, informa o total e ordena de forma determinística com
    desempate por `id`
  - Teste: `employees.repository.integration.spec.ts` → "pagina sem repetir nem omitir item"
  - Commit: `feat(employees)` · `069b239`

- [x] **TASK-015** · P1 · `employees` · adiciona consulta e atualizacao de colaborador
  - Requisitos: REQ-01.4, REQ-01.5
  - Depende de: TASK-013
  - Aceite: identificação inexistente ou removida responde não encontrado; "QUANDO os dados de
    um colaborador ativo são atualizados com valores válidos, o sistema DEVE persistir a
    alteração"
  - Teste: `employees.service.spec.ts` → "responde não encontrado para colaborador removido" e
    "persiste alteração de colaborador ativo"
  - Commit: `feat(employees)` · `3c46d5e`
  - **Decisão confirmada com o humano, não coberta por `design.md`**: `PATCH` também valida
    unicidade de e-mail entre ativos (REQ-01.3), excluindo o próprio colaborador da
    comparação — a invariante vale a qualquer momento, não só na criação. Coberta pelo teste
    "rejeita update com e-mail já usado por outro colaborador ativo".

- [>] **TASK-016** · P1 · `employees` · adiciona atualizacao de colaborador
  - Consolidada em **TASK-015**: mesma entidade, mesmo módulo, duas asserções combinadas, e
    mesma natureza de preocupação — leitura e escrita do cadastro de colaborador.

- [x] **TASK-017** · P0 · `employees` · adiciona soft delete de colaborador
  - Requisitos: REQ-12.1, REQ-12.6, REQ-14.1
  - Depende de: TASK-015
  - Aceite: "QUANDO um colaborador é removido, o sistema DEVE marcá-lo como removido sem
    apagá-lo fisicamente"; remoção de já removido responde não encontrado
  - Teste: `employees.repository.integration.spec.ts` → "preserva a linha após remoção"
  - Commit: `feat(employees)` · `8099d09`

- [x] **TASK-018** · P0 · `employees` · libera email para novo cadastro apos remocao
  - Requisitos: REQ-12.5, REQ-14.7
  - Depende de: TASK-017
  - Aceite: "QUANDO um colaborador é removido, o sistema DEVE liberar seu endereço de e-mail
    para uso por um novo cadastro"
  - Teste: `employees.repository.integration.spec.ts` → "aceita cadastro com e-mail de
    colaborador removido"
  - Commit: `feat(employees)` · `c73ea3f`
  - Sem código de produção novo — a garantia já existia por construção desde TASK-012
    (índice parcial) e TASK-013 (`findActiveByEmail`/`create` só sobre ativos). Esta task
    prova o caminho de ponta a ponta pela camada de repositório.

- [x] **TASK-019** · P0 · `employees` · cobre exclusao de removidos na listagem
  - Requisitos: REQ-14.2
  - Depende de: TASK-017, TASK-014
  - Aceite: colaborador removido não aparece na listagem nem é contado no total
  - Teste: `employees.repository.integration.spec.ts` → "exclui removido da listagem e do total"
  - Sem código de produção novo — `findAllActive` (TASK-014) já filtra pelo alias principal
    via `@DeleteDateColumn`. Task de verificação, commit `test`.
  - Commit: `test(employees)` · `fee3f40`

---

## Tipos de documento

- [x] **TASK-020** · P1 · `document-types` · adiciona entidade e migration de tipos de documento
  - Requisitos: REQ-02.2
  - Depende de: TASK-004
  - Aceite: migration cria `document_types` com `uq_document_types_name` parcial
  - Teste: `document-types.repository.integration.spec.ts` → "aplica o índice único parcial de nome"
  - Commit: `feat(document-types)` · `fcbbd7c`

- [x] **TASK-021** · P1 · `document-types` · adiciona cadastro de tipo de documento
  - Requisitos: REQ-02.1, REQ-02.3
  - Depende de: TASK-020, TASK-009
  - Aceite: cadastra e devolve identificação; nome já pertencente a tipo ativo é rejeitado
    com conflito
  - Teste: `document-types.service.spec.ts` → "rejeita nome já usado por tipo ativo"
  - Commit: `feat(document-types)` · `52fcc2b`

- [x] **TASK-022** · P1 · `document-types` · adiciona listagem paginada e consulta de tipo
  - Requisitos: REQ-02.4, REQ-02.5, REQ-11.1
  - Depende de: TASK-021, TASK-011
  - Aceite: lista apenas ativos, paginado, com total; identificação inexistente ou removida
    responde não encontrado
  - Teste: `document-types.repository.integration.spec.ts` → "exclui removido da listagem" e
    `document-types.service.spec.ts` → "responde não encontrado para tipo removido"
  - Commit: `feat(document-types)` · `e16b024`

- [>] **TASK-023** · P1 · `document-types` · adiciona consulta de tipo por id
  - Consolidada em **TASK-022**: mesmo catálogo, mesmo módulo, três asserções combinadas, e
    mesma natureza de preocupação — leitura do catálogo de tipos.

- [x] **TASK-024** · P0 · `document-types` · adiciona soft delete de tipo de documento
  - Requisitos: REQ-13.1, REQ-13.6, REQ-14.7
  - Depende de: TASK-022
  - Aceite: marca como removido sem apagar fisicamente e libera o nome para novo cadastro
  - Teste: `document-types.repository.integration.spec.ts` → "libera o nome após remoção"
  - Commit: `feat(document-types)`

---

## Vínculo

- [x] **TASK-025** · P1 · `employee-documents` · adiciona entidade e migration do vinculo
  - Requisitos: REQ-03.6
  - Depende de: TASK-012, TASK-020
  - Aceite: migration cria `employee_documents` com `uq_employee_document_active` parcial,
    `deletion_cause` e o `CHECK` que amarra causa a `deleted_at` (D-12)
  - Teste: `employee-documents.repository.integration.spec.ts` → "rejeita vínculo removido
    sem causa de remoção"
  - Commit: `feat(employee-documents)` · `9eb604f`

- [x] **TASK-026** · P1 · `employee-documents` · adiciona vinculacao em lote transacional
  - Requisitos: REQ-03.1, REQ-03.2
  - Depende de: TASK-025, TASK-010
  - Aceite: "QUANDO um colaborador ativo é vinculado a um ou mais tipos de documento ativos,
    o sistema DEVE criar um vínculo por tipo informado, todos no estado pendente"
  - Teste: `employee-documents.service.spec.ts` → "cria um vínculo por tipo informado"
  - Commit: `feat(employee-documents)` · `7198ceb`

- [x] **TASK-027** · P0 · `employee-documents` · cobre rollback da vinculacao em lote
  - Requisitos: REQ-03.2, REQ-15.2, REQ-15.3
  - Depende de: TASK-026
  - Aceite: "QUANDO uma vinculação em lote é solicitada, o sistema DEVE criar todos os
    vínculos solicitados ou nenhum deles"
  - Teste: `employee-documents.integration.spec.ts` → "falha no meio do lote não deixa
    vínculo parcial"
  - Sem código de produção novo — `TransactionRunner` (TASK-026) já garante atomicidade por
    construção. Task de verificação.
  - Commit: `test(employee-documents)` · `ef66227`

- [x] **TASK-028** · P1 · `employee-documents` · rejeita lote invalido ou com vinculo duplicado
  - Requisitos: REQ-03.3, REQ-03.4, REQ-03.5
  - Depende de: TASK-027
  - Aceite: tipo removido/inexistente, colaborador removido/inexistente, ou vínculo ativo já
    existente rejeitam a operação inteira, sem criar nenhum vínculo
  - Teste: `employee-documents.service.spec.ts` → "rejeita lote inteiro com tipo removido",
    "rejeita lote inteiro com colaborador removido ou inexistente" e "rejeita lote com
    vínculo ativo duplicado" (o terceiro caso do Aceite, REQ-03.4, não estava nomeado na
    linha original de `Teste:` — adicionado para cobrir o Aceite por completo)
  - Commit: `feat(employee-documents)` · `913f700`

- [>] **TASK-029** · P1 · `employee-documents` · rejeita lote com vinculo ativo duplicado
  - Consolidada em **TASK-028**: mesma operação de lote, mesmo módulo, três asserções
    combinadas, e mesma natureza de preocupação — rejeição de entrada inválida.

- [x] **TASK-030** · P1 · `employee-documents` · adiciona desvinculacao com causa manual
  - Requisitos: REQ-04.1, REQ-04.3, REQ-04.5
  - Depende de: TASK-026
  - Aceite: marca o vínculo como removido gravando `deletion_cause = 'MANUAL'`; vínculo já
    removido responde não encontrado
  - Teste: `employee-documents.repository.integration.spec.ts` → "grava causa MANUAL na
    desvinculação"; adicionado também `employee-documents.service.spec.ts` → "responde não
    encontrado para vínculo já removido" (REQ-04.5 não estava coberto pelo teste de
    repositório sozinho)
  - Commit: `feat(employee-documents)` · `2e22e05`

---

## Propagação de remoção

O código que escreve em `employee_documents` vive no módulo dono (D-10). As tasks de
`employees` e `document-types` apenas chamam o service público dentro da transação já
aberta — por isso cada propagação são **duas** tasks, não uma.

- [ ] **TASK-031** · P0 · `employee-documents` · adiciona remocao em lote de vinculos por colaborador
  - Requisitos: REQ-12.2
  - Depende de: TASK-030
  - Aceite: marca como removidos todos os vínculos ativos do colaborador, gravando causa,
    aceitando `EntityManager` externo
  - Teste: `employee-documents.repository.integration.spec.ts` → "remove todos os vínculos
    ativos do colaborador"
  - Commit: `feat(employee-documents)`

- [ ] **TASK-032** · P0 · `employees` · propaga remocao de colaborador aos vinculos
  - Requisitos: REQ-12.3, REQ-12.4, REQ-15.1
  - Depende de: TASK-031, TASK-017
  - Aceite: "QUANDO um colaborador é removido, o sistema DEVE marcá-lo e propagar a remoção
    aos seus vínculos de forma atômica"
  - Teste: `employees.integration.spec.ts` → "remove colaborador e vínculos na mesma transação"
  - Commit: `feat(employees)`

- [ ] **TASK-033** · P0 · `employee-documents` · adiciona remocao em lote de vinculos por tipo
  - Requisitos: REQ-13.2, REQ-13.3
  - Depende de: TASK-030
  - Aceite: marca como removidos os vínculos ativos do tipo, gravando
    `deletion_cause = 'TYPE_REMOVED'`, aceitando `EntityManager` externo
  - Teste: `employee-documents.repository.integration.spec.ts` → "grava causa TYPE_REMOVED
    na cascata"
  - Commit: `feat(employee-documents)`

- [ ] **TASK-034** · P0 · `document-types` · propaga remocao de tipo aos vinculos
  - Requisitos: REQ-13.4, REQ-15.1
  - Depende de: TASK-033, TASK-024
  - Aceite: "QUANDO um tipo de documento é removido, o sistema DEVE marcá-lo e propagar a
    remoção aos vínculos afetados de forma atômica"
  - Teste: `document-types.integration.spec.ts` → "remove tipo e vínculos na mesma transação"
  - Commit: `feat(document-types)`

---

## Re-vínculo

- [ ] **TASK-035** · P1 · `employee-documents` · permite re-vinculo apos desvinculacao
  - Requisitos: REQ-05.1, REQ-05.2
  - Depende de: TASK-030
  - Aceite: "QUANDO um colaborador é vinculado a um tipo de documento com o qual já teve
    vínculo removido, o sistema DEVE criar um vínculo novo e distinto do anterior"
  - Teste: `employee-documents.repository.integration.spec.ts` → "cria vínculo novo após
    desvinculação"
  - Commit: `feat(employee-documents)`

- [>] **TASK-036** · P1 · `employee-documents` · cobre isolamento do vinculo anterior no re-vinculo
  - Realocada para **TASK-062**. A prova exige submissions (TASK-044) e a listagem de
    pendentes (TASK-048), que só existem adiante; mantida aqui como marcador para não
    renumerar as tasks seguintes. REQ-05.3 e REQ-05.4 seguem cobertos.

---

## Envio e versionamento

- [ ] **TASK-037** · P1 · `submissions` · adiciona entidade e migration de envios
  - Requisitos: REQ-06.3
  - Depende de: TASK-025
  - Aceite: migration cria `document_submissions` com `uq_submission_active` parcial,
    `uq_submission_version` **não parcial** e `idx_submissions_recent` (§1.3)
  - Teste: `submissions.repository.integration.spec.ts` → "aplica os três índices declarados"
  - Commit: `feat(submissions)`

- [ ] **TASK-038** · P1 · `submissions` · adiciona envio de documento como versao 1
  - Requisitos: REQ-06.1, REQ-06.2
  - Depende de: TASK-037, TASK-010
  - Aceite: "QUANDO um documento é enviado para um vínculo ativo sem envio anterior, o
    sistema DEVE registrar o envio como versão 1 e marcá-lo como ativo"
  - Teste: `submissions.service.spec.ts` → "registra primeiro envio como versão 1 ativa"
  - Commit: `feat(submissions)`

- [ ] **TASK-039** · P0 · `submissions` · garante versao ativa unica via indice parcial
  - Requisitos: REQ-07.3
  - Depende de: TASK-038
  - Aceite: tentativa de inserir segundo envio ativo para o mesmo vínculo falha no banco
  - Teste: `submissions.repository.integration.spec.ts` → "rejeita segundo envio ativo"
  - Commit: `test(submissions)`

- [ ] **TASK-040** · P0 · `submissions` · adiciona reenvio com incremento de versao
  - Requisitos: REQ-07.1, REQ-07.2, REQ-07.4
  - Depende de: TASK-039
  - Aceite: "QUANDO um documento é reenviado para um vínculo que já possui envio ativo, o
    sistema DEVE desativar o envio anterior e registrar o novo com a versão incrementada em 1"
  - Teste: `submissions.service.spec.ts` → "desativa anterior e incrementa versão"
  - Commit: `feat(submissions)`

- [ ] **TASK-041** · P0 · `submissions` · traduz violacao de unicidade discriminando a constraint
  - Requisitos: REQ-07.5, REQ-19.2
  - Depende de: TASK-040, TASK-006
  - Aceite: `uq_submission_active` → `ConcurrentSubmissionError` (409);
    `uq_submission_version` → conflito de versão; demais unicidades →
    `DuplicatedResourceError` (D-14)
  - Teste: `unique-violation.mapper.spec.ts` → "discrimina conflito de ativo de conflito de versão"
  - Commit: `feat(submissions)`

- [ ] **TASK-042** · P0 · `submissions` · cobre reenvios simultaneos com promise.all
  - Requisitos: REQ-07.5, REQ-07.6
  - Depende de: TASK-041
  - Aceite: exatamente uma submission ativa, `version` sem buraco, e um 409 identificando
    `CONCURRENT_SUBMISSION`
  - Teste: `submissions.concurrency.integration.spec.ts` → "persiste exatamente um de dois
    reenvios simultâneos"
  - Commit: `test(submissions)`

- [ ] **TASK-043** · P0 · `submissions` · rejeita envio para vinculo removido
  - Requisitos: REQ-06.4, REQ-06.5, REQ-14.8
  - Depende de: TASK-038, TASK-030
  - Aceite: "SE o envio for solicitado para um vínculo removido ou inexistente, ENTÃO o
    sistema DEVE responder que o recurso não foi encontrado, e não com erro interno"
  - Teste: `submissions.service.spec.ts` → "responde não encontrado para vínculo removido"
  - Commit: `feat(submissions)`

- [ ] **TASK-044** · P0 · `submissions` · adiciona consulta do historico de versoes
  - Requisitos: REQ-09.1, REQ-09.2, REQ-09.3
  - Depende de: TASK-040
  - Aceite: retorna todos os envios do vínculo, ativos e inativos, indicando versão, instante
    e qual é o ativo, em ordem determinística de versão
  - Teste: `submissions.repository.integration.spec.ts` → "retorna histórico ordenado por versão"
  - Commit: `feat(submissions)`

- [ ] **TASK-045** · P0 · `submissions` · mantem historico acessivel apos remocao
  - Requisitos: REQ-09.4, REQ-09.5, REQ-14.6
  - Depende de: TASK-044, TASK-032
  - Aceite: histórico segue consultável após remoção do vínculo e do colaborador
  - Teste: `submissions.integration.spec.ts` → "histórico segue acessível após remoção do
    colaborador"
  - Commit: `feat(submissions)`

- [ ] **TASK-046** · P0 · `submissions` · adiciona remocao do envio ativo
  - Requisitos: REQ-08.1, REQ-08.2, REQ-08.3, REQ-08.6
  - Depende de: TASK-044
  - Aceite: marca `deleted_at` e `is_active = false`, **não** reativa versão anterior, e envio
    já removido responde não encontrado (D-13)
  - Teste: `submissions.service.spec.ts` → "remove envio ativo sem reativar o anterior"
  - Commit: `feat(submissions)`

- [ ] **TASK-047** · P0 · `submissions` · nao reaproveita numero de versao apos remocao
  - Requisitos: REQ-08.4
  - Depende de: TASK-046
  - Aceite: "QUANDO um novo envio ocorre após a remoção do envio ativo, o sistema DEVE
    continuar a contagem de versões a partir da maior versão já usada no vínculo"
  - Teste: `submissions.repository.integration.spec.ts` → "não reemite número de versão já usado"
  - Commit: `test(submissions)`

---

## Listagem de pendentes

- [ ] **TASK-048** · P1 · `employee-documents` · adiciona listagem de pendentes derivada
  - Requisitos: REQ-10.1, REQ-10.5, REQ-10.6, REQ-11.1
  - Depende de: TASK-038, TASK-011
  - Aceite: lista vínculos ativos sem envio ativo via `NOT EXISTS` (D-03), identificando
    colaborador e tipo, paginado com total
  - Teste: `employee-documents.repository.integration.spec.ts` → "exclui vínculo com envio ativo"
  - Commit: `feat(employee-documents)`

- [ ] **TASK-049** · P1 · `employee-documents` · adiciona filtros de pendentes por colaborador e tipo
  - Requisitos: REQ-10.2, REQ-10.3, REQ-10.4
  - Depende de: TASK-048
  - Aceite: filtra por colaborador, por tipo, e aplica ambos de forma cumulativa
  - Teste: `employee-documents.repository.integration.spec.ts` → "aplica filtros cumulativamente"
  - Commit: `feat(employee-documents)`

- [ ] **TASK-050** · P1 · `employee-documents` · retorna vazio para filtro com registro removido
  - Requisitos: REQ-10.7
  - Depende de: TASK-049
  - Aceite: "SE um filtro referenciar colaborador ou tipo de documento inexistente ou
    removido, ENTÃO o sistema DEVE retornar resultado vazio, e não erro"
  - Teste: `employee-documents.service.spec.ts` → "retorna vazio para filtro com tipo removido"
  - Commit: `feat(employee-documents)`

- [ ] **TASK-051** · P0 · `employee-documents` · cobre coerencia da pendencia derivada
  - Requisitos: REQ-15.4
  - Depende de: TASK-048, TASK-046
  - Aceite: após envio, reenvio, remoção de envio e soft delete, a listagem de pendentes
    reflete exatamente o estado real das submissions
  - Teste: `pending.coherence.integration.spec.ts` → "listagem acompanha cada transição de estado"
  - Commit: `test(employee-documents)`

- [ ] **TASK-052** · P0 · `employee-documents` · exclui de pendentes vinculos de colaborador ou tipo removido
  - Requisitos: REQ-14.3, REQ-14.4
  - Depende de: TASK-048, TASK-032, TASK-034
  - Aceite: vínculo cujo colaborador ou tipo foi removido some de pendentes **mesmo que o
    próprio vínculo não esteja marcado** — os JOINs repetem `deleted_at IS NULL` (D-06)
  - Teste: `employee-documents.repository.integration.spec.ts` → "exclui pendente de
    colaborador removido"
  - Commit: `test(employee-documents)`

- [ ] **TASK-070** · P1 · `db` · valida plano de consulta dos pendentes com explain
  - Requisitos: REQ-10.1
  - Depende de: TASK-048
  - Aceite: `EXPLAIN` confirma que o anti-join usa `uq_submission_active`, conforme afirmado
    em D-03; se não usar, abrir task de índice dedicado
  - Teste: verificação documentada no README
  - Commit: `chore(db)`

---

## Estatísticas

- [ ] **TASK-053** · P1 · `statistics` · adiciona agregacao de conformidade global
  - Requisitos: REQ-16.1, REQ-16.2, REQ-16.3
  - Depende de: TASK-048
  - Aceite: expõe `employeesFullyCompliantPercentage` e `documentsSubmittedPercentage`,
    nomeados sem ambiguidade, calculados em SQL (D-09)
  - Teste: `statistics.repository.integration.spec.ts` → "calcula os dois percentuais distintos"
  - Commit: `feat(statistics)`

- [ ] **TASK-054** · P1 · `statistics` · exclui colaborador sem vinculo do denominador
  - Requisitos: REQ-16.4
  - Depende de: TASK-053
  - Aceite: colaborador ativo sem nenhum vínculo ativo fica fora do denominador, e a
    quantidade de excluídos é informada separadamente
  - Teste: `statistics.repository.integration.spec.ts` → "cadastrar colaborador sem vínculo
    não altera o percentual"
  - Commit: `feat(statistics)`

- [ ] **TASK-055** · P1 · `statistics` · retorna valor definido para base vazia
  - Requisitos: REQ-16.6
  - Depende de: TASK-053
  - Aceite: "SE não houver nenhum registro que sirva de base para uma medida, ENTÃO o sistema
    DEVE retornar um valor definido para ela, e não erro" — `NULLIF` em toda divisão
  - Teste: `statistics.repository.integration.spec.ts` → "responde sem erro em base vazia"
  - Commit: `feat(statistics)`

- [ ] **TASK-056** · P1 · `statistics` · adiciona tipos mais pendentes
  - Requisitos: REQ-17.1, REQ-17.2, REQ-17.3
  - Depende de: TASK-048
  - Aceite: quantidade de vínculos ativos pendentes por tipo, ordenada da maior para a menor,
    com desempate determinístico
  - Teste: `statistics.repository.integration.spec.ts` → "ordena tipos por pendência com
    desempate estável"
  - Commit: `feat(statistics)`

- [ ] **TASK-057** · P1 · `statistics` · adiciona ultimos envios
  - Requisitos: REQ-18.1, REQ-18.2, REQ-18.3
  - Depende de: TASK-044
  - Aceite: envios mais recentes primeiro, identificando colaborador, tipo, versão e instante,
    com limite padrão e teto documentados
  - Teste: `statistics.repository.integration.spec.ts` → "retorna últimos envios do mais novo
    ao mais antigo"
  - Commit: `feat(statistics)`

- [ ] **TASK-058** · P1 · `statistics` · inclui envios inativos nos ultimos envios
  - Requisitos: REQ-18.5, REQ-18.6
  - Depende de: TASK-057
  - Aceite: envio que não é mais a versão ativa continua aparecendo, por representar entrega
    ocorrida; empate de instante desempatado deterministicamente
  - Teste: `statistics.repository.integration.spec.ts` → "inclui versão superada nos últimos envios"
  - Commit: `feat(statistics)`

- [ ] **TASK-059** · P0 · `statistics` · exclui removidos dos dois denominadores
  - Requisitos: REQ-16.5, REQ-14.5
  - Depende de: TASK-054, TASK-032, TASK-034
  - Aceite: colaborador, tipo e vínculo removidos saem de ambas as medidas de conformidade
  - Teste: `statistics.softdelete.integration.spec.ts` → "colaborador removido sai do denominador"
  - Commit: `test(statistics)`

- [ ] **TASK-060** · P0 · `statistics` · exclui removidos dos rankings e dos ultimos envios
  - Requisitos: REQ-17.4, REQ-18.4, REQ-14.5
  - Depende de: TASK-056, TASK-058, TASK-032, TASK-034
  - Aceite: tipos mais pendentes ignora removidos nos três níveis; últimos envios ignora
    envios de vínculo, colaborador ou tipo removido
  - Teste: `statistics.softdelete.integration.spec.ts` → "ranking e últimos envios ignoram
    removidos"
  - Commit: `test(statistics)`

---

## Varredura de soft delete

Fecham o requisito mais destacado do enunciado. Dependem de o sistema estar inteiro.

- [ ] **TASK-061** · P0 · `employee-documents` · cobre preservacao de submissions apos cascata de tipo
  - Requisitos: REQ-13.5, REQ-14.6
  - Depende de: TASK-034, TASK-045
  - Aceite: removido o tipo, os vínculos somem de pendentes e dos dois denominadores, e as
    submissions históricas continuam acessíveis
  - Teste: `type-removal.cascade.integration.spec.ts` → "cascata preserva submissions históricas"
  - Commit: `test(employee-documents)`

- [ ] **TASK-062** · P1 · `employee-documents` · cobre isolamento do vinculo anterior no re-vinculo
  - Requisitos: REQ-05.3, REQ-05.4
  - Depende de: TASK-035, TASK-044, TASK-048
  - Aceite: o vínculo anterior e seus envios seguem consultáveis, mas não contam para
    pendência nem estatística
  - Teste: `employee-documents.integration.spec.ts` → "vínculo anterior não conta para pendência"
  - Commit: `test(employee-documents)`

---

## Diferenciais

- [ ] **TASK-064** · P2 · `shared` · adiciona health check com verificacao do banco
  - Requisitos: REQ-21.1, REQ-21.2
  - Depende de: TASK-004
  - Aceite: `/health` reporta estado da conexão com o banco; banco indisponível reporta
    estado não saudável, e não sucesso
  - Teste: `health.integration.spec.ts` → "reporta não saudável com o banco fora"
  - Commit: `feat(shared)`

- [ ] **TASK-065** · P2 · `shared` · adiciona logs estruturados com request id correlacionado
  - Requisitos: REQ-20.1, REQ-20.2, REQ-20.3
  - Depende de: TASK-007
  - Aceite: registros em JSON, todos os logs de uma requisição sob o mesmo identificador, e
    esse identificador é o mesmo devolvido nas respostas de erro
  - Teste: `logger.integration.spec.ts` → "usa o mesmo requestId do payload de erro"
  - Commit: `feat(shared)`

- [ ] **TASK-066** · P2 · `shared` · omite dado pessoal dos registros de execucao
  - Requisitos: REQ-20.4
  - Depende de: TASK-065
  - Aceite: nome e e-mail de colaborador não aparecem em texto aberto nos logs
  - Teste: `logger.redaction.spec.ts` → "redige e-mail de colaborador"
  - Commit: `feat(shared)`

- [ ] **TASK-067** · P2 · `shared` · habilita log legivel fora de producao
  - Requisitos: REQ-20.5
  - Depende de: TASK-065
  - Aceite: transport legível por humano ativo apenas fora de produção
  - Teste: verificação manual documentada no README
  - Commit: `feat(shared)`

- [ ] **TASK-068** · P2 · `infra` · adiciona documentacao openapi
  - Requisitos: REQ-22.1, REQ-22.2, REQ-22.3
  - Depende de: TASK-053
  - Aceite: rotas de §4 documentadas a partir dos DTOs, com o catálogo de códigos de erro
  - Teste: verificação manual documentada no README
  - Commit: `chore(infra)`

- [ ] **TASK-069** · P2 · `infra` · adiciona suite e2e do fluxo completo
  - Requisitos: REQ-06, REQ-07, REQ-09, REQ-10, REQ-16
  - **Exceção de nível:** os REQs que ela exercita são P0, mas a suíte E2E é diferencial
    declarado do enunciado, e a cobertura P0 desses REQs já está garantida pelas tasks de
    unidade e integração. Fica P2.
  - Depende de: TASK-060, TASK-002
  - Aceite: vincular, enviar, reenviar, consultar histórico, remover e conferir estatística,
    via HTTP contra o `docker-compose`
  - Teste: `e2e/fluxo-completo.spec.ts` → "percorre o ciclo de vida de um documento"
  - Commit: `feat(infra)`

---

## Melhorias opcionais


- [ ] **TASK-071** · P3 · `db` · adiciona seeds de demonstracao
  - Requisitos: —
  - Depende de: TASK-048
  - Aceite: seed popula base suficiente para as estatísticas retornarem valores não triviais
  - Teste: verificação manual documentada no README
  - Commit: `feat(db)`

- [ ] **TASK-072** · P3 · `infra` · adiciona commitlint
  - Requisitos: —
  - Depende de: TASK-001
  - Aceite: commit fora do padrão de `convencoes.md` é rejeitado
  - Teste: verificação manual documentada no README
  - Commit: `chore(infra)`

---

## Fechamento

Fase 3 do `spec-flow`. Origem "Entrega / fechamento" → **P0**: o README é o entregável de
maior peso do projeto, e a varredura final é o critério mais destacado do enunciado. Sem
task, nenhum dos dois é rastreado.

**Exceção de nível, declarada.** TASK-074 a TASK-076 referenciam REQ-00, cuja origem é
Fundação (P1). O nível delas vem da origem **da task**, não do requisito que citam: são
entregáveis de fechamento, avaliados diretamente. Esta é a única exceção ao mapeamento em que
a origem da task prevalece sobre a do requisito.

- [ ] **TASK-073** · P0 · `shared` · percorre o checklist completo de varredura de soft delete
  - Requisitos: REQ-14
  - Depende de: TASK-062, TASK-063
  - Aceite: os doze itens do checklist de `convencoes.md` são conferidos no código, item a
    item, e cada um registra onde foi verificado
  - Teste: `softdelete.sweep.integration.spec.ts` → "nenhum item do checklist falha"
  - Commit: `test(shared)`

- [ ] **TASK-074** · P0 · `shared` · audita rastreabilidade de requisito para task
  - Requisitos: REQ-00
  - Depende de: TASK-073
  - Aceite: todo `REQ-##` tem task concluída ou justificativa registrada de não
    implementação; requisito órfão é bug de processo. **Tasks de origem "Entrega /
    fechamento" (TASK-073 a TASK-077) são isentas de mapeamento para `REQ`** — a categoria de
    origem é a rastreabilidade delas, e cobrar `REQ` faria a auditoria acusar a si mesma
  - Teste: verificação documentada no README
  - Commit: `docs`

- [ ] **TASK-075** · P0 · `shared` · escreve readme final com decisoes e trade-offs
  - Requisitos: REQ-00
  - Depende de: TASK-074
  - Aceite: as nove seções da estrutura de `convencoes.md`, incluindo "o que ficou de fora e
    por quê", alimentada pelas tasks `[~]`
  - Teste: verificação documentada no próprio README
  - Commit: `docs`

- [ ] **TASK-076** · P0 · `infra` · valida a entrega em clone limpo
  - Requisitos: REQ-00
  - Depende de: TASK-075
  - Aceite: `git clone` em diretório novo, README seguido ao pé da letra, sistema sobe, migra
    e responde — funcionar na máquina onde foi construído não prova nada
  - Teste: verificação manual documentada no README
  - Commit: `chore(infra)`

---

## Auditoria de atomicidade

Os quatro sinais do `SKILL.md` foram aplicados a cada task. **Oito quebras** resultaram disso,
e **três foram depois revertidas** — o sinal "título com 'e' ligando dois verbos" sobre-dispara
e foi qualificado em `spec-standard.md`.

| Task original | Sinal disparado | Quebrada em | Situação |
|---|---|---|---|
| "exception filter com request id e 500 seguro" | Mais de três asserções | TASK-006, 007, 008 | Mantida |
| "consulta e atualização de colaborador" | Título com "e" | TASK-015, 016 | **Revertida** |
| "listagem paginada e consulta por id de tipos" | Título com "e" | TASK-022, 023 | **Revertida** |
| "vinculação em lote com validações" | Mais de três asserções | TASK-026, 028, 029 | **Parcial** — 028+029 reunidas |
| "propaga remoção de colaborador aos vínculos" | **Toca dois módulos donos** | TASK-031, 032 | Mantida |
| "propaga remoção de tipo aos vínculos" | **Toca dois módulos donos** | TASK-033, 034 | Mantida |
| "envio com versionamento e concorrência" | Mais de três asserções | TASK-038, 040, 041, 042 | Mantida |
| "exclui removidos das estatísticas" | Mais de três asserções | TASK-059, 060 | Mantida |

### Critério de consolidação — quatro condições

Duas metades ficam **unidas** quando satisfazem **todas**:

1. Mesma **entidade**
2. Mesmo **módulo**
3. No máximo **três asserções** combinadas
4. Mesma **natureza de preocupação**

A quarta condição não é redundante: sem ela, a regra reconsolidaria na próxima varredura
exatamente os dois pares recusados abaixo, que passam nas três primeiras.

**Recusadas, com o motivo:**

- **TASK-007 + TASK-008.** Passam nas três primeiras e falham na quarta: request-id é
  observabilidade, não vazar stack em 500 é propriedade de segurança. Um commit dedicado ao
  item de segurança é o tipo de coisa que se procura numa revisão.
- **TASK-066 + TASK-067.** Idem: juntaria uma task com teste automatizado (redação de e-mail
  nos logs) com uma de verificação manual (transport legível fora de produção). O elo "o teste
  prova o critério" ficaria meio provado, meio não.

As duas quebras por **módulo dono** seguem sendo as que mais mudaram o resultado. A redação
natural seria uma task "remoção de colaborador propaga aos vínculos", mas o código que escreve
em `employee_documents` pertence a `employee-documents`, não a `employees` (D-10). Manter uma
task só teria produzido um commit que escreve em módulo alheio — exatamente o acoplamento que
a arquitetura declara evitar.

Nenhuma task ativa dispara os sinais sob o critério revisado: nenhuma toca dois módulos donos,
nenhum critério de aceite tem mais de três asserções independentes, e todas nomeiam o teste
que as prova. Os títulos compostos que restam (`TASK-015`, `TASK-022`, `TASK-028`) são
deliberados e satisfazem as quatro condições.

---

## Manutenção

### Marcadores

| Marcador | Significado | Alimenta "o que ficou de fora" do README? |
|---|---|---|
| `[x]` | Concluída, com o hash curto do commit | Não |
| `[ ]` | Pendente | Não |
| `[~]` | **Descartada** — não será feita, com uma linha de justificativa | **Sim** |
| `[>]` | **Realocada ou absorvida** — executada sob outro ID | **Não** |

A distinção entre `[~]` e `[>]` existe porque os dois foram confundidos numa versão anterior:
uma task realocada marcada como descartada apareceria, na hora de gerar o README, entre as
coisas **não feitas** — quando foi feita, sob outro número.

### Regras

- Task descoberta durante a execução entra no fim do nível apropriado, nunca vira código
  extra no commit atual.
- Task consolidada em outra preserva o **menor** ID; o maior vira `[>]` apontando para ele.
