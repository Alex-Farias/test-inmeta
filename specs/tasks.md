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

- [x] **TASK-031** · P0 · `employee-documents` · adiciona remocao em lote de vinculos por colaborador
  - Requisitos: REQ-12.2
  - Depende de: TASK-030
  - Aceite: marca como removidos todos os vínculos ativos do colaborador, gravando causa,
    aceitando `EntityManager` externo
  - Teste: `employee-documents.repository.integration.spec.ts` → "remove todos os vínculos
    ativos do colaborador"; adicionado também "preserva a causa de vínculo já desvinculado
    manualmente", que prova a parte **"ativos"** do Aceite — sem ele o filtro
    `deletedAt: IsNull()` poderia sumir sem nenhum teste acusar
  - Commit: `feat(employee-documents)` · `c87f231`
  - **Decisão confirmada com o humano, não coberta por `design.md`**: D-12 previa apenas
    `MANUAL` e `TYPE_REMOVED`, e a cascata de remoção de colaborador não tinha causa própria.
    Acrescentado `EMPLOYEE_REMOVED`, simétrico a `TYPE_REMOVED` — um valor por gatilho de
    cascata. Sem migration: a coluna é `varchar(20)` sem `CHECK` de enum. D-12 atualizada no
    mesmo commit.

- [x] **TASK-032** · P0 · `employees` · propaga remocao de colaborador aos vinculos
  - Requisitos: REQ-12.3, REQ-12.4, REQ-15.1
  - Depende de: TASK-031, TASK-017
  - Aceite: "QUANDO um colaborador é removido, o sistema DEVE marcá-lo e propagar a remoção
    aos seus vínculos de forma atômica"
  - Teste: `employees.integration.spec.ts` → "remove colaborador e vínculos na mesma transação";
    adicionado também "desfaz a remoção do colaborador se a propagação falhar" — o primeiro
    prova a propagação, mas passaria igual sem transação nenhuma; só o segundo prova a parte
    **atômica** do Aceite. `employees.service.spec.ts` → "remove colaborador ativo propagando
    aos vinculos na mesma transacao" cobre o mesmo na unidade, pela identidade do `manager`
  - Commit: `feat(employees)` · `fa0aca0`
  - **`forwardRef` nos dois módulos.** `employee-documents` já importava `employees` desde a
    TASK-026; a propagação fecha o ciclo. Os dois lados passam a usar `forwardRef` — nenhum
    alcança repositório alheio, que é o que D-10 de fato proíbe. O grafo de DI foi verificado
    subindo a aplicação, não só pelos testes: os specs constroem os services à mão e não
    exercitam o container do Nest.

- [x] **TASK-033** · P0 · `employee-documents` · adiciona remocao em lote de vinculos por tipo
  - Requisitos: REQ-13.2, REQ-13.3
  - Depende de: TASK-030
  - Aceite: marca como removidos os vínculos ativos do tipo, gravando
    `deletion_cause = 'TYPE_REMOVED'`, aceitando `EntityManager` externo
  - Teste: `employee-documents.repository.integration.spec.ts` → "grava causa TYPE_REMOVED
    na cascata"; adicionado também "preserva a causa de vínculo já desvinculado manualmente",
    espelhando o equivalente da TASK-031 — prova a parte **"ativos"** do Aceite
  - Commit: `feat(employee-documents)` · `9d8ede7`
  - **Refatoração confirmada com o humano**, embora encoste em código da TASK-031: o corpo
    comum das duas cascatas saiu para `softDeleteAllByParent` privado. O ganho não é reduzir
    repetição — são duas linhas — e sim manter o `deletedAt: IsNull()` em um ponto só, que é
    a guarda que um terceiro gatilho perderia ao copiar um dos métodos públicos sem revisar.

- [x] **TASK-034** · P0 · `document-types` · propaga remocao de tipo aos vinculos
  - Requisitos: REQ-13.4, REQ-15.1
  - Depende de: TASK-033, TASK-024
  - Aceite: "QUANDO um tipo de documento é removido, o sistema DEVE marcá-lo e propagar a
    remoção aos vínculos afetados de forma atômica"
  - Teste: `document-types.integration.spec.ts` → "remove tipo e vínculos na mesma transação";
    adicionado também "desfaz a remoção do tipo se a propagação falhar", pelo mesmo motivo da
    TASK-032 — o primeiro prova a propagação e passaria igual sem transação nenhuma; só o
    segundo prova a parte **atômica**. `document-types.service.spec.ts` → "remove tipo ativo
    propagando aos vinculos na mesma transacao" cobre o mesmo na unidade
  - Commit: `feat(document-types)` · `82e8a15`
  - **Segundo `forwardRef` do sistema**, mesma justificativa do primeiro: `employee-documents`
    já importava `document-types` desde a TASK-026, e a propagação fecha o ciclo. Grafo de DI
    verificado subindo a aplicação, não só pelos testes.
  - REQ-13.5 (preservar os envios dos vínculos afetados) é atendido por construção — a cascata
    para no vínculo. A prova fica na TASK-061, quando `document_submissions` existir.

---

## Re-vínculo

- [x] **TASK-035** · P1 · `employee-documents` · permite re-vinculo apos desvinculacao
  - Requisitos: REQ-05.1
  - Depende de: TASK-030
  - Aceite: "QUANDO um colaborador é vinculado a um tipo de documento com o qual já teve
    vínculo removido, o sistema DEVE criar um vínculo novo e distinto do anterior"
  - Teste: `employee-documents.repository.integration.spec.ts` → "cria vínculo novo após
    desvinculação"; adicionado também `employee-documents.integration.spec.ts` → "revincula
    par desvinculado sem acusar duplicidade". O critério fala em **"é vinculado"** — a
    operação, não o `INSERT` —, e o teste de repositório sozinho não alcança a checagem de
    duplicidade da TASK-028, que é onde o requisito de fato quebraria
  - Commit: `test(employee-documents)` · `e082b2d`
  - Sem código de produção novo — a garantia já existia por construção desde TASK-025
    (`uq_employee_document_active` parcial) e TASK-026 (`findActiveDocumentTypeIds` usa
    `find`, que recebe o filtro do `@DeleteDateColumn`). Task de verificação, commit `test`,
    como TASK-018/019/027. **Os dois testes foram verificados a morder**: com o índice sem
    `WHERE` o primeiro falha por `23505`; com `withDeleted: true` na checagem, o segundo falha
    por `DuplicatedResourceError`.
  - **REQ-05.2 saiu desta task para a TASK-062**, confirmado com o humano: exige
    `document_submissions`, que só nasce na TASK-037. Ver a nota lá e em D-07.

- [>] **TASK-036** · P1 · `employee-documents` · cobre isolamento do vinculo anterior no re-vinculo
  - Realocada para **TASK-062**. A prova exige submissions (TASK-044) e a listagem de
    pendentes (TASK-048), que só existem adiante; mantida aqui como marcador para não
    renumerar as tasks seguintes. REQ-05.3 e REQ-05.4 seguem cobertos.

---

## Envio e versionamento

- [x] **TASK-037** · P1 · `submissions` · adiciona entidade e migration de envios
  - Requisitos: REQ-06.3
  - Depende de: TASK-025
  - Aceite: migration cria `document_submissions` com `uq_submission_active` parcial,
    `uq_submission_version` **não parcial** e `idx_submissions_recent` (§1.3)
  - Teste: `submissions.repository.integration.spec.ts` → "aplica os três índices declarados",
    que confere as três definições em `pg_indexes`; adicionados "rejeita segundo envio ativo
    para o mesmo vínculo" e "não reemite versão de envio removido", porque conferir a
    definição prova que o índice **existe**, não que a semântica é a pretendida — e a natureza
    não parcial do segundo índice é a mais fácil de reverter por engano
  - Commit: `feat(submissions)` · `2084712`
  - Migration também verificada com `npm run migration:run` sobre o banco de desenvolvimento:
    Testcontainers sempre parte de banco limpo e não prova o empilhamento sobre as três
    migrations anteriores.

- [x] **TASK-038** · P1 · `submissions` · adiciona envio de documento como versao 1
  - Requisitos: REQ-06.1, REQ-06.2
  - Depende de: TASK-037
  - Aceite: "QUANDO um documento é enviado para um vínculo ativo sem envio anterior, o
    sistema DEVE registrar o envio como versão 1 e marcá-lo como ativo"
  - Teste: `submissions.service.spec.ts` → "registra primeiro envio como versão 1 ativa", mais
    "traduz violação de unicidade em conflito de concorrência" e "não engole erro de banco que
    não seja violação de unicidade" para o `catch` introduzido aqui; e
    `submissions.repository.integration.spec.ts` → "começa em 1 para vínculo sem envio",
    "conta envios removidos ao calcular a próxima versão" e "registra o envio como ativo no
    instante da entrega", porque o spec de unidade mocka `findNextVersion` e deixaria o SQL do
    `COALESCE` sem execução
  - Commit: `feat(submissions)` · `c51e1af`
  - **`TASK-010` removida das dependências.** Ficou vestigial: sem `TransactionRunner` aqui,
    porque é inserção única e a garantia de "no máximo um ativo" está em `uq_submission_active`
    desde a TASK-037 (D-02). A transação entra na TASK-040, onde há duas escritas a coordenar.
  - **Traduz `23505` já nesta task**, antecipando parte da TASK-041: a corrida de dois
    primeiros envios simultâneos é tão real quanto a de reenvio, e sem a tradução o perdedor
    receberia 500 cru no intervalo entre as duas tasks. Ver a nota na TASK-041.
  - REQ-06.2 é satisfeito **por construção** — sob D-03 "entregue" é derivado da existência de
    submission ativa, e não há escrita no vínculo que pudesse divergir.
  - **Ressalva do aceite.** Neste commit o reenvio para o mesmo vínculo ainda **não** é
    suportado: retorna 409 por violar `uq_submission_active`, porque nada desativa o envio
    anterior. REQ-07 inteiro é fechado pela TASK-040, não por esta. Sem a ressalva, o commit
    isolado se lê como se envio e reenvio já estivessem completos aqui.

- [x] **TASK-039** · P0 · `submissions` · prova concorrencia no primeiro envio via indice parcial
  - Requisitos: REQ-07.3, REQ-07.5
  - Depende de: TASK-038
  - Aceite: duas requisições de primeiro envio disparadas simultaneamente para o mesmo vínculo
    — exatamente uma submission persiste com `version = 1` e `is_active = true`; a perdedora
    recebe `ConcurrentSubmissionError` **ou** `VersionConflictError` (409 em ambos), não 500
    cru. Usa **barreira explícita de transação** (sincronização manual do ponto de overlap),
    não `Promise.all` ingênuo — ver `design.md` §5
  - **Aceite corrigido depois da TASK-041.** A redação original exigia um único tipo de erro
    para a transação perdedora. Com `VersionConflictError` passando a existir, ficou visível
    que esta corrida viola as **duas** constraints na mesma tentativa de escrita — as duas
    inserções propõem `version = 1` sobre um vínculo sem envio nenhum — e qual delas o
    Postgres reporta é ordem de checagem interna, não contrato: instável entre versões do
    servidor e sob recriação de índice. O aceite passou a admitir os dois. Não é afrouxamento:
    as asserções que provam REQ-07.3 — exatamente uma linha, `version = 1`, ativa — seguem
    exatas. Ver `design.md` §5, "O limite da discriminação de D-14"
  - Teste: `submissions.concurrency.integration.spec.ts` → "persiste exatamente um de dois
    primeiros envios simultâneos"
  - Commit: `test(submissions)` · `bd89a15`
  - **Re-escopada, não absorvida.** O teste que esta task declarava ("rejeita segundo envio
    ativo") foi entregue por engano no commit da TASK-037, junto dos testes de índice. Ele
    permanece lá: prova que a constraint existe e rejeita duplicata sob escrita **não
    concorrente**, o que é válido por si. Mas REQ-07.3 diz "EM QUALQUER MOMENTO" — afirmação
    sobre concorrência, que duas inserções sequenciais sub-provam. O que faltava era a corrida
    real, e é o que esta task passou a cobrir.
  - Cobre também a tradução de `23505` introduzida na TASK-038, que até aqui só tinha
    cobertura por mock, com o código de erro fabricado à mão.
  - **Não é duplicata da TASK-042.** Esta é concorrência no **primeiro** envio — duas
    inserções disputando uma linha que ainda não existe. A TASK-042 é concorrência no
    **reenvio** — duas transações disputando desativar a linha existente e inserir a próxima.
    Mesma constraint, dois caminhos de código, cada um precisa da sua prova.
  - **Primeira versão do teste estava errada, corrigida durante a TASK-040.** Ela usava
    `Promise.all` sobre duas chamadas de service e passou por motivo errado: as transações não
    se sobrepunham, e o que ela de fato provava era a **ausência de suporte a reenvio** — o
    segundo envio colidia porque nada desativava o anterior. Assim que a TASK-040 introduziu a
    desativação, os dois envios passaram a ter sucesso e o teste quebrou. A correção instala
    uma barreira em `findNextVersion`, prendendo as duas chamadas depois de a transação abrir
    e antes da inserção disputada. Ver `design.md` §5 e
    `test/helpers/concurrent-transactions.ts`.

- [x] **TASK-040** · P0 · `submissions` · adiciona reenvio com incremento de versao
  - Requisitos: REQ-07.1, REQ-07.2, REQ-07.4
  - Depende de: TASK-039
  - Aceite: "QUANDO um documento é reenviado para um vínculo que já possui envio ativo, o
    sistema DEVE desativar o envio anterior e registrar o novo com a versão incrementada em 1".
    O cálculo de versão usa `MAX(version)` sobre **todas** as submissions do vínculo, não
    apenas a ativa — pré-requisito para TASK-047: depois de uma remoção não há ativa, mas o
    histórico permanece, e reaproveitar o número quebraria REQ-08.4
  - Teste: `submissions.service.spec.ts` → "desativa anterior e incrementa versão", que assere
    a identidade do `manager` nas três chamadas e a ordem desativar-antes-de-inserir;
    `submissions.integration.spec.ts` → "desativa o envio anterior e registra o próximo como
    ativo", "mantém a sequência de versões contígua ao longo de vários reenvios" e "desfaz a
    desativação do anterior se a inserção falhar" — o último é o que prova o que a transação
    de fato compra, e o único que falharia sem ela
  - Commit: `feat(submissions)` · `dfe12d2`
  - **`TransactionRunner` entra aqui pela primeira vez no caminho de envio.** `enviar` segue
    um método só para envio e reenvio (rota única, D-16): o primeiro envio é o caso degenerado,
    porque `deactivateActive` afeta zero linhas quando não há ativa. Sem branch, e sem TOCTOU
    entre consultar e escrever.
  - **Quebrou o teste da TASK-039 e expôs um defeito nele.** Com a desativação, dois envios
    "simultâneos" sem sobreposição real passam a ser envio + reenvio legítimos, e o teste
    antigo — que dependia de `Promise.all` — falhou. A correção veio antes, em `dcca316`.

- [x] **TASK-041** · P0 · `submissions` · traduz violacao de unicidade discriminando a constraint
  - Requisitos: REQ-07.5, REQ-19.2
  - Depende de: TASK-040, TASK-006
  - Aceite: `uq_submission_active` → `ConcurrentSubmissionError` (409);
    `uq_submission_version` → `VersionConflictError` (409); demais unicidades →
    `DuplicatedResourceError` (409, default da tabela) (D-14)
  - Teste: `constraint-error-map.spec.ts` → "discrimina conflito de ativo de conflito de versão",
    mais "cai no default para unicidade não reconhecida", "devolve nulo para erro que não é
    23505" e "lê a constraint do driverError quando o erro vem embrulhado";
    `submissions.service.spec.ts` → "traduz colisão de versão em conflito de versão";
    `exception.filter.spec.ts` → "traduz 23505 não tratado pela mesma tabela dos services" e
    "não registra 23505 traduzido como falha não prevista", que são o que prova a rede
  - Commit: `feat(shared)` · `ca42823`
  - **Escopo `shared`, não `submissions`.** O dono da task continua sendo `submissions`, mas
    seis dos oito arquivos de código são `src/shared/` — a classe de erro, a tabela e o
    filter. `escopo = módulo` aponta para onde o código mora.
  - **Estende, não introduz.** A TASK-038 já traduz `23505` em `ConcurrentSubmissionError`,
    porque sem isso a corrida de dois primeiros envios devolveria 500 cru no intervalo entre
    as duas tasks. O que falta aqui é a discriminação por nome de constraint (D-14) e a
    extração do tratamento para um ponto único.
  - **Escopo ampliado por três decisões**, todas registradas em `design.md`: classe
    `VersionConflictError` própria (D-08, §4.6), tabela central em
    `shared/errors/constraint-error-map.ts` em vez de lógica repetida por ponto de uso, e a
    mesma tabela aplicada no service **e** no exception filter — este último como rede para
    `23505` vindo de outros módulos, sem escrita neles (D-14).
  - **Cuidado medido na TASK-039, resolvido por declaração e não por heurística.** Na corrida
    de primeiro envio as duas constraints são violadas pela mesma inserção, e qual delas o
    Postgres reporta é ordem de checagem interna. A alternativa de discriminação contextual
    foi considerada e descartada — registro em `design.md`, D-14, "Alternativa descartada
    (2)". A tabela ficou plana e a não-determinação está declarada em `design.md` §5, com a
    correção consequente na asserção da TASK-039.
  - **Um teste existente mudou de veículo, não de propósito.** "responde 500 genérico sem
    expor stack" (`exception.filter.spec.ts`) usava um erro `23505` para provar REQ-19.4;
    com a rede no filter, aquele código deixou de ser erro não mapeado. O caso passou a usar
    violação de chave estrangeira (`23503`) e mantém todas as asserções de não vazamento.

- [x] **TASK-042** · P0 · `submissions` · cobre reenvios simultaneos com barreira de transacao
  - Requisitos: REQ-07.5, REQ-07.6
  - Depende de: TASK-041
  - **Usa `test/helpers/concurrent-transactions.ts`**, extraído na correção da TASK-039. Não
    reinventar com `Promise.all`: o helper existe porque essa abordagem produz falso positivo
    silencioso, e a TASK-042 corre exatamente o mesmo risco. Ver `design.md` §5.
  - Aceite: exatamente uma submission ativa, `version` sem buraco, e um 409 identificando
    `CONCURRENT_SUBMISSION`
  - Teste: `submissions.concurrency.integration.spec.ts` → "persiste exatamente um de dois
    reenvios simultâneos"
  - Commit: `test(submissions)` · `9ec3952`
  - **A barreira vai em `deactivateActive`, não em `findNextVersion`.** Copiar a posição da
    TASK-039 travaria a suíte: no reenvio a primeira escrita é o `UPDATE` que desativa a
    versão ativa, e ele toma lock de linha. A primeira transação passaria pelo `UPDATE` e só
    então esperaria na barreira; a segunda bloquearia **no `UPDATE`**, sem nunca alcançá-la —
    um participante de dois chega, a barreira não libera, timeout sem defeito algum no
    sistema. A regra em `design.md` §5 foi refinada por causa deste caso: "antes da primeira
    escrita", não "antes da escrita disputada".
  - **Asserção estrita em `ConcurrentSubmissionError`**, ao contrário da TASK-039. Aqui a
    discriminação de D-14 é determinística: a perdedora só prossegue após o commit da
    vencedora, calcula a versão seguinte a ela — número que ninguém tem — e colide apenas em
    `uq_submission_active`. É este caso que sustenta a afirmação de `design.md` §5 de que a
    não-determinação se restringe à corrida de primeiro envio.
  - **Falsificado antes de commitar.** Com a barreira removida, os dois reenvios passaram
    (versões 2 e 3, sem sobreposição alguma) — exatamente o falso positivo que o helper
    existe para impedir, agora demonstrado também neste caminho.
  - **Não prova o rollback.** Nesta interleaving o `UPDATE` da perdedora destrava depois do
    commit da vencedora e afeta zero linhas, então não há desativação a desfazer: quem impede
    o "zero ativo" aqui é o lock, não a transação. A prova do rollback é "desfaz a desativação
    do anterior se a inserção falhar", da TASK-040.
  - **Não é duplicata da TASK-039**, apesar de as duas usarem `Promise.all` sobre a mesma
    constraint e morarem no mesmo arquivo. Lá são duas inserções disputando uma linha que
    ainda não existe, sem transação; aqui são duas transações disputando desativar a linha
    existente e inserir a próxima. O segundo caminho tem estado anterior a preservar, e é o
    único dos dois onde REQ-07.6 — "sem versão órfã" — pode falhar de verdade.

- [x] **TASK-043** · P0 · `submissions` · rejeita envio para vinculo removido
  - Requisitos: REQ-06.4, REQ-06.5, REQ-14.8
  - Depende de: TASK-038, TASK-030
  - Aceite, um 404 para os três requisitos que a task já declarava:
    - REQ-06.4 — "SE o envio for solicitado para um vínculo removido ou inexistente, ENTÃO o
      sistema DEVE responder que o recurso não foi encontrado, e não com erro interno"
    - REQ-06.5 — "SE o envio for solicitado para um vínculo cujo colaborador está removido,
      ENTÃO o sistema DEVE rejeitar a operação"
    - REQ-14.8 — "SE uma operação de escrita for solicitada sobre um registro removido, ENTÃO
      o sistema DEVE responder que o recurso não foi encontrado" — aqui, o vínculo cujo tipo
      de documento foi removido
  - Teste: `submissions.service.spec.ts` → "responde não encontrado para vínculo removido ou
    inexistente", para a ramificação; `submissions.integration.spec.ts` →
    `describe('vínculo inválido')` com os quatro casos, para a consulta
  - Commit: `feat(submissions)` · `05f0dc0`
  - **Aceite expandido, requisitos inalterados.** A redação original citava só a frase de
    REQ-06.4, embora a linha `Requisitos` já listasse os três. Os três são fechados pelo mesmo
    método e passaram a aparecer explicitamente — rastreabilidade não deve depender de quem lê
    o comentário do código.
  - **O teste declarado não provava o requisito.** O caso em `submissions.service.spec.ts`
    mocka o repositório: prova que o service ramifica quando vem `null`, e passaria igual se a
    consulta não tivesse JOIN nenhum. O que decide REQ-06.5 é **quando** a consulta devolve
    `null`, e isso só o Postgres responde. Mesmo padrão da re-escopagem da TASK-039 — o caso
    unitário permanece, mas a prova do requisito é a de integração.
  - **`findSubmittableById`, separado de `findActiveById`.** Faz `INNER JOIN` em `employees` e
    `document_types` repetindo `AND <alias>.deleted_at IS NULL` (D-06). É o **primeiro JOIN
    manual em código de produção** do projeto. JOIN por nome de tabela, não por entidade: o
    vínculo entre módulos é por coluna uuid, sem `@ManyToOne`, e importar entidade alheia
    contradiria §2.1.
  - **A cascata não é a garantia.** Sem os JOINs, REQ-06.5 dependeria de a propagação de
    TASK-032 ter marcado o vínculo — e D-06 declara a propagação como defesa em profundidade.
    Os testes de integração removem o pai **direto pelo `DataSource`**, sem cascata, porque é
    a única construção que separa o que o JOIN garante do que a propagação mascara.
  - **Falsificado antes de commitar.** Retirados os dois `innerJoin`, os casos de colaborador
    e tipo removidos falham — o envio é aceito e grava a versão 1 — enquanto os de vínculo
    removido e inexistente continuam passando, porque esses o filtro automático do alias
    principal já cobre. É a medida exata do que os JOINs acrescentam.

- [ ] **TASK-079** · P1 · `employee-documents` · exige cadeia ativa tambem na desvinculacao
  - Requisitos: REQ-14.8
  - Depende de: TASK-043
  - Aceite: desvinculação de vínculo cujo colaborador ou tipo esteja removido — ainda que o
    próprio vínculo não esteja marcado — responde que o recurso não foi encontrado, e não com
    erro interno
  - Teste: `employee-documents.integration.spec.ts` → "recusa desvinculação de vínculo com
    colaborador removido"
  - Commit: `feat(employee-documents)`
  - **Assimetria descoberta na TASK-043 e deixada de fora dela de propósito.** A desvinculação
    (`employee-documents.service.ts`) segue usando `findActiveById`, sem os JOINs, então herda
    exatamente a dependência da cascata que a TASK-043 removeu do caminho de envio. Corrigir
    ali teria mudado o comportamento de REQ-04 dentro de um commit que diz tratar de envio.
  - **Menor gravidade que a TASK-043, e por isso P1.** Desvincular um vínculo cujo pai já foi
    removido é operação idempotente na prática — o registro já está fora de toda consulta. O
    que se ganha é uniformidade da regra de D-06, não correção de comportamento observável.

- [x] **TASK-044** · P0 · `submissions` · adiciona consulta do historico de versoes
  - Requisitos: REQ-09.1, REQ-09.2, REQ-09.3
  - Depende de: TASK-040
  - Aceite: retorna todos os envios do vínculo, ativos e inativos, indicando versão, instante
    e qual é o ativo, em ordem determinística de versão
  - Teste: `submissions.repository.integration.spec.ts` → "retorna histórico ordenado por
    versão", mais "não mistura envios de outro vínculo", "inclui envio removido no histórico",
    "pagina o histórico sem repetir nem omitir versão" e "retorna página vazia para vínculo
    sem envio"
  - Commit: `feat(submissions)` · `9cabdd5`
  - **`deletedAt` entrou no payload, quinto campo (design §4.3).** Com os quatro de REQ-09.2,
    um envio removido e um superado por reenvio ficam idênticos na resposta — ambos
    `isActive: false`. REQ-08 exige que a remoção não falsifique o histórico, e não distinguir
    os dois falsifica por omissão. A tabela de combinações das duas colunas foi registrada em
    §4.3 como contrato, não como comentário de código.
  - **Segundo `withDeleted` do sistema**, e o comentário de `findNextVersion` — que se
    declarava "único ponto que ignora o filtro de soft delete" — foi corrigido. Os dois motivos
    são diferentes: lá é não reemitir número de versão, aqui é a exceção declarada a REQ-14.2.
  - **Ordem `version DESC` sem desempate por `id`**, ao contrário do que D-15 exige das outras
    listagens: `uq_submission_version` torna `version` única por vínculo, então ela já é
    ordenação total e não há dois envios que possam trocar de posição entre páginas.
  - **Falsificado antes de commitar.** Retirado o `withDeleted`, "inclui envio removido no
    histórico" falha — total 2 em vez de 3.
  - **Ressalva do aceite.** Um id de vínculo que nunca existiu ainda devolve página vazia, não
    404. A distinção entre inexistente e removido é da TASK-045, que introduz `findAnyById`.
    Sem a ressalva, o commit isolado se lê como se REQ-09 estivesse inteiro aqui.

- [x] **TASK-045** · P0 · `submissions` · mantem historico acessivel apos remocao
  - Requisitos: REQ-09.4, REQ-09.5, REQ-14.6
  - Depende de: TASK-044, TASK-032
  - Aceite, os três casos que `findAnyById` distingue:
    - vínculo **removido** → 200 com o histórico completo (REQ-09.4)
    - vínculo **ativo** → 200 com o histórico completo
    - id que **nunca existiu** → 404, não página vazia
  - Teste: `submissions.integration.spec.ts` → "histórico segue acessível após remoção do
    colaborador", "histórico segue acessível após remoção do vínculo" e "responde não
    encontrado para vínculo que nunca existiu"
  - Commit: `feat(submissions)` · `392153a`
  - **Aceite ampliado.** A redação original cobria só o caso que motivou a task — histórico
    após remoção. Os três casos saem do mesmo método e o terceiro é o que justifica
    `findAnyById` existir: sem ele bastaria consultar as submissions direto, e um uuid
    digitado errado responderia 200 com página vazia, afirmando que o vínculo existe.
  - **Terceiro `find...ById` do repositório, e por isso a tabela-índice.** `findActiveById`
    (REQ-04.5), `findSubmittableById` (REQ-06.5) e `findAnyById` (REQ-09.4) têm visibilidades
    diferentes de `deleted_at`, em ordem de rigor decrescente. Trocar um pelo outro não dá
    erro de compilação e quebra um requisito em silêncio — o comentário-índice fica acima dos
    três para que um quarto não nasça reimplementando um deles.
  - **Contraste deliberado com a TASK-043**, no mesmo arquivo de teste: para **enviar**,
    vínculo ou colaborador removido dá 404; para **consultar o histórico**, os mesmos estados
    dão 200. É a exceção declarada a REQ-14.2, e os dois `describe` vizinhos a tornam legível.
  - **Prova a ausência de cascata até `document_submissions`.** O caso do colaborador removido
    assere que os envios seguem com `deletedAt: null`. Se alguma propagação alcançasse a
    tabela, o histórico encolheria e a terceira linha da tabela de §4.3 passaria a significar
    outra coisa.
  - **Falsificado antes de commitar.** Retirado o `withDeleted` de `findAnyById`, os dois casos
    de remoção falham; o de id inexistente continua passando, porque não depende dele.

- [x] **TASK-046** · P0 · `submissions` · adiciona remocao do envio ativo
  - Requisitos: REQ-08.1, REQ-08.2, REQ-08.3, REQ-08.6
  - Depende de: TASK-044
  - Aceite: marca `deleted_at` e `is_active = false`, **não** reativa versão anterior, e envio
    já removido responde não encontrado (D-13)
  - Teste: `submissions.service.spec.ts` → "remove envio ativo sem reativar o anterior", mais
    "responde não encontrado para envio já removido" e "não tenta remover envio de vínculo
    removido ou inexistente"; `submissions.repository.integration.spec.ts` →
    `describe('softDeleteActive')`, cinco casos
  - Commit: `feat(submissions)` · `98e237e`
  - **Teste de integração acrescentado ao aceite.** O unitário declarado prova a
    **ramificação** — que nada é reativado e que os dois `null` viram 404 — mas com o
    repositório dublado ele passaria igual se o `UPDATE` gravasse só uma das duas colunas. As
    duas juntas são a semântica da terceira linha da tabela de §4.3, e só a integração as vê
    na linha. Fecha também o único método de repositório que nasceria sem cobertura contra
    Postgres real.
  - **`findSubmittableById`, o mesmo de `enviar`**, e não `findActiveById` como em
    `desvincular`. Remover envio é caminho de **escrita**, e D-06 declara que a regra do JOIN
    vale igual dos dois lados; REQ-14.8 manda 404 para escrita solicitada sobre registro
    removido. Consequência aceita: o envio de um vínculo cujo colaborador foi removido não
    pode mais ser removido — a operação de escrita fica indisponível junto com o resto da
    cadeia.
  - **O contraste com `consultarHistorico` está no mesmo arquivo, dois métodos abaixo.**
    Vínculo removido: **ler** o histórico responde 200 (exceção declarada a REQ-14.2),
    **escrever** nele responde 404. Não é inconsistência, é a regra e sua única exceção — e a
    vizinhança dos dois métodos é o que torna isso legível para quem chega depois.
  - **Não crítica, e isso é decisão registrada, não omissão** (D-04). `UPDATE` de linha única:
    a atomicidade vem do statement, e abrir transação seria cerimônia sem garantia. É uma das
    quatro linhas da tabela de operações não críticas que o enunciado cobra discriminar.
  - **`active` no caminho, não o uuid da submission.** O envio removível é sempre o vigente
    (REQ-08.1); uma rota por id convidaria a remover uma versão no meio do histórico, que
    REQ-08.3 proíbe. A rota declara o alvo em vez de aceitar qualquer um e recusar depois.
  - Suíte de integração ficou bloqueada na primeira tentativa — Docker Desktop sem integração
    com a distro WSL, `Could not find a working container runtime strategy`. Nenhum commit foi
    feito até ela rodar de fato.

- [x] **TASK-047** · P0 · `submissions` · nao reaproveita numero de versao apos remocao
  - Requisitos: REQ-08.4
  - Depende de: TASK-046
  - Aceite: "QUANDO um novo envio ocorre após a remoção do envio ativo, o sistema DEVE
    continuar a contagem de versões a partir da maior versão já usada no vínculo"
  - Teste: `submissions.repository.integration.spec.ts` → "não reemite número de versão já
    usado"; `submissions.integration.spec.ts` → "continua a contagem de versões após a remoção
    do envio ativo", mais "mantém o vínculo pendente enquanto não há novo envio" e "responde
    não encontrado ao remover envio já removido"
  - Commit: `test(submissions)` · `1eb5a52`
  - **Terceiro teste do projeto sobre número de versão, e os três provam coisas distintas.**
    O de `describe('migration')` (TASK-037) prova o **índice**: `uq_submission_version` não é
    parcial, então a versão removida segue ocupando o slot. O de `findNextVersion` prova o
    **cálculo** isolado. Os dois são contrapositivos — mostram que a colisão *aconteceria*.
    Este prova o **ciclo**: remoção de produção, recálculo e inserção seguinte entrando de
    fato. É o único que passa por `softDeleteActive` em vez de `softDelete` cru.
  - **Dois níveis, de propósito.** O do repositório monta o ciclo chamando os métodos direto;
    o do service vai por `enviar` e `removerEnvioAtivo`, que é como a sequência acontece na
    rota. O segundo é o que enxerga a ordem interna de `enviar` — desativar, recalcular,
    inserir — e a leitura literal de REQ-08.4 ("QUANDO um novo envio ocorre após a remoção").
  - **Levou junto o estado que D-13 declara válido**: vínculo pendente **com** histórico, sem
    envio ativo e sem versão anterior reativada. Ele não tinha teste explícito e é o que a
    listagem de pendentes vai encontrar na TASK-048.
  - **Falsificado antes de commitar.** Comentado o `.withDeleted()` de `findNextVersion`, os
    dois testes novos falham com `Expected: 2, Received: 1` — junto do de TASK-037, que já
    cobria o cálculo. É a proteção que o comentário do método pede e não podia cobrar sozinho.
  - Nenhuma linha de produção no commit, como o tipo `test` promete.

---

## Listagem de pendentes

- [x] **TASK-048** · P1 · `employee-documents` · adiciona listagem de pendentes derivada
  - Requisitos: REQ-10.1, REQ-10.5, REQ-10.6, REQ-11.1
  - Depende de: TASK-038, TASK-011
  - Aceite: lista vínculos ativos sem envio ativo via `NOT EXISTS` (D-03), identificando
    colaborador e tipo, paginado com total
  - Teste: `employee-documents.repository.integration.spec.ts` → "exclui vínculo com envio ativo"
  - Commit: `feat(employee-documents)` · `aaa587d`
  - **Teste com três vínculos, não dois.** Além do que exclui envio ativo, inclui um vínculo
    com submission **inativa** (histórico sem envio ativo) — é o estado que a nota da
    TASK-047 registrou como válido e sem cobertura até aqui, e falsifica um `NOT EXISTS` que
    esquecesse o `is_active` (excluiria também quem só tem histórico).

- [x] **TASK-049** · P1 · `employee-documents` · adiciona filtros de pendentes por colaborador e tipo
  - Requisitos: REQ-10.2, REQ-10.3, REQ-10.4
  - Depende de: TASK-048
  - Aceite: filtra por colaborador, por tipo, e aplica ambos de forma cumulativa
  - Teste: `employee-documents.repository.integration.spec.ts` → "aplica filtros cumulativamente"
  - Commit: `feat(employee-documents)` · `f8bc13c`
  - **Teste expandido para três `it()`.** O nome único declarado prova só o caso cumulativo;
    sozinho ele passaria com um filtro quebrado desde que o outro compensasse. Adicionados
    "filtra por colaborador" e "filtra por tipo", isolando cada um (REQ-10.2, REQ-10.3), mesmo
    padrão de expansão da TASK-028/030/043.

- [x] **TASK-050** · P1 · `employee-documents` · retorna vazio para filtro com registro removido
  - Requisitos: REQ-10.7
  - Depende de: TASK-049
  - Aceite: "SE um filtro referenciar colaborador ou tipo de documento inexistente ou
    removido, ENTÃO o sistema DEVE retornar resultado vazio, e não erro"
  - Teste: `employee-documents.service.spec.ts` → "retorna vazio para filtro com tipo removido"
  - Commit: `test(employee-documents)` · `581d926`
  - **Sem código de produção novo — a garantia já existia por construção desde a TASK-049**,
    mesmo padrão de TASK-018/019/027/035: `WHERE vinculo.employee_id = :employeeId` não casa
    nenhuma linha para id inexistente, e o `innerJoin` com `deleted_at IS NULL` (D-06) exclui
    o vínculo mesmo que a cascata (TASK-032/034) não o tenha marcado. Re-escopado de `feat`
    para `test`.
  - **O teste declarado, sozinho, não prova o requisito.** `employee-documents.service.spec.ts`
    mocka o repositório: prova que o service não valida existência via
    `EmployeesService`/`DocumentTypesService` antes de filtrar (o que lançaria
    `EntityNotFoundError` exatamente no caso que REQ-10.7 manda tratar em silêncio), mas
    passaria igual com qualquer `findPending`, inclusive um quebrado. Adicionado
    `employee-documents.repository.integration.spec.ts` → `findPending` → "filtro para
    registro removido ou inexistente", com dois casos: colaborador removido **direto pelo
    `DataSource`** (bypassa a cascata, mesma técnica de TASK-043/045, para isolar a defesa do
    JOIN) e id que nunca existiu.

- [x] **TASK-051** · P0 · `employee-documents` · cobre coerencia da pendencia derivada
  - Requisitos: REQ-15.4
  - Depende de: TASK-048, TASK-046
  - Aceite: após envio, reenvio, remoção de envio e soft delete, a listagem de pendentes
    reflete exatamente o estado real das submissions
  - Teste: `pending.coherence.integration.spec.ts` → "listagem acompanha cada transição de estado"
  - Commit: `test(employee-documents)` · `f7406bc`
  - **Sem código de produção novo** — um dos quatro testes que `design.md` §5 chama de "testes
    que carregam o peso da avaliação" (REQ-15.4), provando que D-03 satisfaz a coerência por
    construção. Um único vínculo passa por vincular → enviar → reenviar → remover envio ativo
    → desvincular, conferindo `listarPendentes` a cada passo — via `EmployeeDocumentsService`/
    `SubmissionsService`, não repositório direto, pela mesma porta que a rota HTTP usa.

- [x] **TASK-052** · P0 · `employee-documents` · exclui de pendentes vinculos de colaborador ou tipo removido
  - Requisitos: REQ-14.3, REQ-14.4
  - Depende de: TASK-048, TASK-032, TASK-034
  - Aceite: vínculo cujo colaborador ou tipo foi removido some de pendentes **mesmo que o
    próprio vínculo não esteja marcado** — os JOINs repetem `deleted_at IS NULL` (D-06)
  - Teste: `employee-documents.repository.integration.spec.ts` → "exclui pendente de
    colaborador removido"
  - Commit: `test(employee-documents)` · `44430c8`
  - **Sem código de produção novo** — mesma query da TASK-048, defesa em profundidade de D-06.
    Colaborador/tipo removidos **direto pelo `DataSource`**, sem passar por
    `removerVinculosDoColaborador`/`removerVinculosDoTipo` (TASK-032/034), para isolar a
    garantia do `innerJoin` da garantia da cascata.
  - **Nome declarado cobre só o colaborador (REQ-14.3).** Adicionado "exclui pendente de tipo
    removido" para REQ-14.4, espelho simétrico — mesmo padrão de expansão da TASK-031/033.

- [x] **TASK-070** · P1 · `db` · valida plano de consulta dos pendentes com explain
  - Requisitos: REQ-10.1
  - Depende de: TASK-048
  - Aceite: `EXPLAIN` confirma que o anti-join usa `uq_submission_active`, conforme afirmado
    em D-03; se não usar, abrir task de índice dedicado
  - Teste: verificação documentada no README
  - Commit: `chore(db)` · `aeff81b`
  - **A previsão de D-03/§1.4 não se confirmou — decisão do aceite executada, não a
    consequência automática.** `EXPLAIN (ANALYZE, BUFFERS)` sobre 5.000 vínculos (4.000 com
    envio ativo) mostra `Hash Anti Join` com `Seq Scan` em `document_submissions`, 3ms,
    `uq_submission_active` fora do plano. Confirmado com o humano: **não** abrir task de
    índice, porque nenhum índice mudaria a conta enquanto o conjunto de submissions ativas
    couber em `work_mem` — a lacuna era a suposição do design, não uma consulta lenta. D-03 e
    §1.4 atualizados no mesmo commit com o achado e a ressalva de escala (o que revisita isso
    é dado real de produção, não teste antecipado).
  - Seed e limpeza feitos por script descartável fora do repositório, contra o Postgres de
    dev já existente (`docker compose`); banco devolvido a zero linhas ao final.

---

## Estatísticas

- [x] **TASK-053** · P1 · `statistics` · adiciona agregacao de conformidade global
  - Requisitos: REQ-16.1, REQ-16.2, REQ-16.3
  - Depende de: TASK-048
  - Aceite: expõe `employeesFullyCompliantPercentage` e `documentsSubmittedPercentage`,
    nomeados sem ambiguidade, calculados em SQL (D-09)
  - Teste: `statistics.repository.integration.spec.ts` → "calcula os dois percentuais distintos"
  - Commit: `feat(statistics)` · `e8f9571`
  - **Módulo novo, sem entidade própria.** `StatisticsRepository` acessa o schema por SQL
    direto via `dataSource.query`/`manager.query` (D-10) — as duas leituras de D-09 num único
    round-trip: `documents_submitted_percentage` agregado sobre a CTE `vinculo`,
    `employees_fully_compliant_percentage` por subquery escalar sobre `por_colaborador`. Os
    três `JOIN ... AND deleted_at IS NULL` do CTE são D-06.
  - **`NULLIF` nas duas divisões desde já**, por ser como D-09 está escrita — verificado
    subindo a aplicação contra o banco de dev vazio: `GET /statistics/overview` responde 200
    com os dois campos em `0`, não erro. Não é a prova de REQ-16.6 (fica para a TASK-055,
    que decide o valor e escreve o teste dedicado).
  - Grafo de DI verificado subindo a aplicação (mesma prática de TASK-032/034):
    `StatisticsModule` inicializa e `GET /statistics/overview` aparece mapeada.

- [x] **TASK-054** · P1 · `statistics` · exclui colaborador sem vinculo do denominador
  - Requisitos: REQ-16.4
  - Depende de: TASK-053
  - Aceite: colaborador ativo sem nenhum vínculo ativo fica fora do denominador, e a
    quantidade de excluídos é informada separadamente
  - Teste: `statistics.repository.integration.spec.ts` → "cadastrar colaborador sem vínculo
    não altera o percentual"
  - Commit: `feat(statistics)` · `6210ca1`
  - **Denominador já excluía por construção.** `por_colaborador` deriva de `vinculo`, que vem
    de `employee_documents` — colaborador sem nenhum vínculo nunca teve linha ali. O que
    faltava era só tornar a exclusão visível: `employeesWithoutRequirements` soma uma
    subquery escalar ao mesmo round-trip, sem segunda consulta.
  - **Nome do teste expandido** — o declarado ("cadastrar colaborador sem vínculo não altera
    o percentual") virou dois momentos no mesmo `it`: percentuais antes/depois de cadastrar
    Bruno sem vínculo, mais a asserção de `employeesWithoutRequirements` indo de `0` a `1`,
    porque só provar "não muda" deixaria a segunda metade do Aceite (contagem separada) sem
    teste.

- [x] **TASK-055** · P1 · `statistics` · retorna valor definido para base vazia
  - Requisitos: REQ-16.6
  - Depende de: TASK-053
  - Aceite: "SE não houver nenhum registro que sirva de base para uma medida, ENTÃO o sistema
    DEVE retornar um valor definido para ela, e não erro" — `NULLIF` em toda divisão
  - Teste: `statistics.repository.integration.spec.ts` → "responde sem erro em base vazia"
  - Commit: `test(statistics)` · `bd9d6db`
  - **Sem código de produção novo** — mesmo padrão de TASK-018/019/027/035/050/052: o
    `NULLIF` já presente desde D-09/TASK-053 fazia a query devolver `NULL` sobre base vazia,
    e `Number(null)` já era `0`. Re-escopado de `feat` para `test`.
  - **Valor `0` confirmado com o humano antes da implementação**, por não estar fixado em
    `design.md` (mesmo padrão de confirmação da TASK-011 para os números de paginação): D-09
    ganhou a nota "base vazia → `0`, por decisão, não efeito colateral do cálculo".

- [x] **TASK-056** · P1 · `statistics` · adiciona tipos mais pendentes
  - Requisitos: REQ-17.1, REQ-17.2, REQ-17.3
  - Depende de: TASK-048
  - Aceite: quantidade de vínculos ativos pendentes por tipo, ordenada da maior para a menor,
    com desempate determinístico
  - Teste: `statistics.repository.integration.spec.ts` → "ordena tipos por pendência com
    desempate estável"
  - Commit: `feat(statistics)` · `78ec6a9`
  - **`LEFT JOIN` a partir de `document_types`, não do anti-join de pendência.** É o que
    garante a leitura literal de REQ-17.1 — "para cada tipo de documento ativo" — inclusive
    os com `pendingCount` zero, que um `INNER JOIN`/anti-join direto omitiria em silêncio.
  - **Teste expandido para dois `it()`.** O nome declarado prova ordenação e desempate;
    adicionado "inclui tipo ativo sem nenhuma pendência" para a leitura literal acima, mesmo
    padrão de expansão de TASK-028/030/043.
  - **Desempate por `dt.id ASC`** — mesma convenção de desempate por `id` de D-15. A prova de
    REQ-17.3 chama a consulta duas vezes e compara a ordem entre as duas, em vez de assumir
    qual dos dois tipos empatados vem primeiro.
  - **Exclusão de removidos (REQ-17.4) por construção, sem teste dedicado aqui** — os
    `deleted_at IS NULL` de D-06 já cobrem tipo/vínculo/colaborador removido; a prova
    explícita é a TASK-060, fora deste lote.

- [ ] **TASK-057** · P1 · `statistics` · adiciona ultimos envios
  - Requisitos: REQ-18.1, REQ-18.2, REQ-18.3
  - Depende de: TASK-044
  - Aceite: envios mais recentes primeiro, identificando colaborador, tipo, versão e instante,
    com limite padrão e teto documentados
  - Teste: `statistics.repository.integration.spec.ts` → "retorna últimos envios do mais novo
    ao mais antigo"
  - Commit: `feat(statistics)` · `ccff373`
  - **Limite padrão/teto confirmados com o humano**, por não estarem fixados em `design.md`
    (mesmo padrão da TASK-011): reaproveita os **números** de D-15 (20/100), não o envelope
    paginado — resposta é array simples, sem `page`/`total`, porque "últimos envios" é top-N.
    `LIMITE_PADRAO`/`LIMITE_TETO` passaram a exportados de `pagination-query.dto.ts` para o
    novo `LatestSubmissionsQueryDto` não duplicar os mesmos números mágicos.
  - **Sem filtro de `is_active` desde já** — nada em REQ-18.1/18.2 pede envio ativo, e a
    tradução direta do requisito já inclui versão superada por reenvio. Mesmo padrão de
    "estende, não introduz" da TASK-038/041: a TASK-058 prova isso de ponta a ponta em vez de
    introduzir o comportamento.
  - **Teste expandido**: além do nome declarado, "aplica o limite informado" prova a metade
    do Aceite que fica do lado do banco (o clamp do próprio DTO reaproveita a lógica já
    provada em `pagination.dto.spec.ts`, sem teste redundante).
  - **`design.md` corrigido no mesmo commit**: o exemplo de `/statistics/overview` trazia um
    campo `totals` que nenhuma task jamais cobriu — removido para o exemplo não afirmar um
    contrato que o sistema não entrega. Ganhou os exemplos JSON de `pending-types` e
    `latest-submissions`.

- [x] **TASK-058** · P1 · `statistics` · inclui envios inativos nos ultimos envios
  - Requisitos: REQ-18.5, REQ-18.6
  - Depende de: TASK-057
  - Aceite: envio que não é mais a versão ativa continua aparecendo, por representar entrega
    ocorrida; empate de instante desempatado deterministicamente
  - Teste: `statistics.repository.integration.spec.ts` → "inclui versão superada nos últimos envios"
  - Commit: `test(statistics)` · `e3168b9`
  - **Sem código de produção novo** — mesmo padrão de TASK-018/019/027/035/050/052: a
    TASK-057 já implementa `ultimosEnvios` sem filtro de `is_active` e já ordena com
    `ORDER BY submitted_at DESC, id DESC`. Re-escopado de `feat` para `test`.
  - **Teste expandido**: além do nome declarado (reenvio com v1 inativa/v2 ativa, ambas
    aparecendo), adicionado "desempata por instante idêntico de forma determinística" para
    REQ-18.6 — duas submissions com o mesmo `submittedAt`, comparando a ordem entre duas
    chamadas, mesmo padrão de prova de estabilidade da TASK-056.

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

- [ ] **TASK-062** · P1 · `employee-documents` · cobre isolamento e reinicio de versao no re-vinculo
  - Requisitos: REQ-05.2, REQ-05.3, REQ-05.4
  - Depende de: TASK-035, TASK-044, TASK-048
  - Aceite: o vínculo anterior e seus envios seguem consultáveis, mas não contam para
    pendência nem estatística; e o novo vínculo inicia submissions em `version = 1`, sem
    herdar a numeração do anterior
  - Teste: `employee-documents.integration.spec.ts` → "vínculo anterior não conta para pendência"
    e "vínculo novo reinicia a numeração de versões"
  - Commit: `test(employee-documents)`
  - **REQ-05.2 veio da TASK-035**, onde não era demonstrável: exige `document_submissions`,
    que só nasce na TASK-037. As três facetas descrevem o mesmo cenário — vínculo recriado
    após desvinculação — e agora são provadas juntas. Ver a nota em D-07.

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
