# API de Gestão de Documentação de Colaboradores

API RESTful para gerenciar o fluxo de documentação obrigatória de colaboradores:
cadastro, vinculação a tipos de documento, envio com histórico versionado,
listagem de pendências e estatísticas de conformidade.

Este é um teste técnico. O escopo funcional é deliberadamente simples. O que
está sendo avaliado é modelagem, tratamento de operações críticas, consistência
sob remoção lógica e as decisões registradas ao longo do caminho, não volume de
features.

---

## Sumário

- [Como rodar](#como-rodar)
- [Stack e ferramentas](#stack-e-ferramentas)
- [Arquitetura](#arquitetura)
- [Modelo de dados](#modelo-de-dados)
- [Decisões técnicas](#decisões-técnicas)
- [Operação e garantias](#operação-e-garantias)
- [Estratégia de testes](#estratégia-de-testes)
- [Processo de desenvolvimento](#processo-de-desenvolvimento)
- [Como o projeto foi construído com Claude Code](#como-o-projeto-foi-construído-com-claude-code)
- [O que ficou de fora e por quê](#o-que-ficou-de-fora-e-por-quê)
- [O que mudaria em produção](#o-que-mudaria-em-produção)

---

## Como rodar

### Pré-requisitos

- Node.js 24.16.0
- Docker

### Subida do ambiente

```bash
git clone <url-do-repositorio>
cd <diretorio>
cp .env.example .env

docker compose up -d          # sobe o Postgres, aguarda o healthcheck
npm install
npm run migration:run         # passo explícito, não automático!
npm run start:dev
```

Confirme que subiu: `GET /health` deve responder `200` (checagem real de
conectividade com o Postgres, via `@nestjs/terminus`). A documentação
interativa sobe junto, em `GET /docs` (Swagger UI, montado por
`@nestjs/swagger` em `src/main.ts`).

Para popular dados de exemplo antes de explorar a API manualmente:

```bash
npm run seed   # ts-node src/database/seed.ts
```

**Por que subir o banco e rodar a migration são dois comandos, não um.**
Por questões de segurança X particidade, um restart acidental do Postgres 
não pode disparar uma alteração de schema que ninguém pediu especificamente.
É a mesma razão pela qual `synchronize` do TypeORM fica
`false` mesmo em desenvolvimento: nada muda o schema como consequência
implícita de o processo simplesmente rodar.

### Testes

```bash
npm test                      # unitários
npm run test:integration      # integração — sobe Postgres via Testcontainers
npm run test:e2e              # Playwright — exige o docker compose no ar
```

---

## Stack e ferramentas

| Camada | Escolha | Por quê | Alternativa descartada |
|---|---|---|---|
| Runtime | Node.js + TypeScript | Exigência do desafio | — |
| Framework | **Nest.js** | Separação de camadas já imposta pelo framework; DI, pipes de validação e exception filters nativos reduzem o risco de errar a estrutura sob prazo | Fastify/Express — mais liberdade, mais chance de decisão de arquitetura mal tomada sob pressão |
| Banco | **PostgreSQL 18** | Índices parciais, transações reais e agregação madura — os três pilares do desafio | — |
| ORM | **TypeORM** | `@DeleteDateColumn` nativo para soft delete, migrations versionadas em TypeScript, QueryBuilder expressivo para as estatísticas | Prisma — exige migration raw para índice parcial de qualquer forma; Drizzle — SQL mais legível, mas menos integrado ao Nest |
| Testes unitários/integração | **Jest + Testcontainers** | Postgres real em container prova transação, rollback e concorrência de verdade — teste com repositório mockado não prova nada sobre escrita em linha real | — |
| Testes E2E | **Playwright** (`APIRequestContext`) | Cobre fluxo completo via HTTP contra o compose, sem precisar de browser | — |
| Validação | class-validator / class-transformer | Padrão Nest, DTOs explícitos | — |
| Documentação | @nestjs/swagger | Diferencial declarado no enunciado | — |
| Logs | nestjs-pino | Logs estruturados com `requestId` de correlação | — |
| Health check | @nestjs/terminus | `GET /health` prova conectividade real com o Postgres, não só "processo de pé" | — |
| Configuração | @nestjs/config + dotenv | Validação de env na subida (`src/config/env.validation.ts`) — falta de variável derruba o processo antes de aceitar tráfego, em vez de falhar tarde na primeira query | — |
| Lint | **ESLint + typescript-eslint** | Regra customizada `no-restricted-syntax` bloqueia `.remove()`/`.softRemove()` e `DELETE FROM` no build — o invariante de soft delete é imposto por ferramenta, não só por revisão | — |
| Formatação | **Prettier** | Formatação automatizada é a forma barata de garantir estilo consistente, sem gastar atenção do revisor nisso | — |
| Git hooks | **Husky + commitlint** | Hook `commit-msg` valida Conventional Commits contra `type`/`scope` fechados por módulo antes do commit existir — erro de convenção nunca chega ao histórico | — |

Justificativa completa de cada escolha, com números de versão fixados, em
[`stack.md`](./stack.md).

### Qualidade de código e commits

```bash
npm run lint     # eslint . — falha se houver .remove()/.softRemove() ou DELETE FROM
npm run format   # prettier --write "src/**/*.ts"
```

O hook `commit-msg` (`.husky/commit-msg`) roda `commitlint` a cada commit,
contra os enums fechados de `commitlint.config.js`:

```
✗ git commit -m "ajustes"                                    # sem type, sem scope
✗ git commit -m "feat: adiciona endpoint"                     # scope obrigatório fora de docs
✓ git commit -m "feat(employee-documents): valida vinculo duplicado"
```

---

## Arquitetura

### Módulos

| Módulo | Responsabilidade |
|---|---|
| `employees` | Colaborador e seu ciclo de vida. Não conhece documentos |
| `document-types` | Catálogo de tipos. Não conhece colaboradores |
| `employee-documents` | Dono do vínculo **e** das submissões de envio |
| `statistics` | Leitura agregada pura |
| `shared` | Erros de domínio, exception filter, paginação, `TransactionRunner`, logger |

**Regra de acoplamento:** módulos se comunicam por services públicos, nunca por
repositórios alheios. `statistics` é a exceção declarada, pois consulta o schema
diretamente por ser leitura agregada, evitando N+1 e composição inútil entre
services.

**Limite transacional = limite do agregado.** `employee-documents` é dono tanto
do vínculo quanto das submissões; nada fora dele cria uma submissão. Por isso
nenhuma transação crítica precisa cruzar módulo.

### Estrutura de pastas

```
src/
├── config/
├── database/
│   ├── data-source.ts        # usado pelo CLI de migrations
│   ├── database.module.ts
│   └── migrations/
├── shared/
│   ├── errors/                # DomainError e subclasses; constraint-error-map.ts
│   ├── filters/                # exception filter global
│   ├── pagination/
│   └── transaction/            # TransactionRunner
└── modules/
    ├── employees/
    ├── document-types/
    ├── employee-documents/     # inclui domain/document-submission.entity.ts
    └── statistics/
specs/
├── requirements.md             # o quê — critérios em EARS
├── design.md                   # como — modelagem, arquitetura, decisões D-##
└── tasks.md                    # em que ordem — histórico de execução
```

---

## Modelo de dados

Quatro entidades no núcleo — não três, e a separação entre as duas últimas é a
decisão da qual todo o resto deriva:

| Entidade | Papel |
|---|---|
| `Employee` | Colaborador |
| `DocumentType` | Catálogo de tipos exigíveis |
| `EmployeeDocument` | **O vínculo** — a obrigação: "este colaborador deve entregar este tipo" |
| `DocumentSubmission` | **O envio** — cada entrega, versionada |

```
Employee 1───N EmployeeDocument N───1 DocumentType
                    │
                    │ 1
                    │
                    N
            DocumentSubmission
```

**Por que separar vínculo de envio.** Colapsar em uma tabela só (um
`documents` com campo `version` sobrescrito) transforma pendência num enum
manual, apaga o histórico e obriga a estatística a depender de subquery
frágil. Com a separação: pendente = vínculo ativo sem submissão ativa; enviado
= vínculo ativo com submissão ativa; histórico = todas as submissões do
vínculo, ativas ou não.

**Pendência é derivada, não armazenada.** Uma versão inicial deste projeto
mantinha um campo `status` no vínculo, escrito a cada operação, para acelerar
a listagem de pendentes. Foi revertida: à medida que operações que escrevem
esse campo cresceram de duas para cinco (envio, reenvio, remoção de envio,
remoção de colaborador, remoção de tipo), o risco de um campo divergir da
realidade passou a pesar mais do que o ganho de performance que ele
prometia — e esse ganho nunca foi medido, só assumido. A alternativa —
`NOT EXISTS` de submissão ativa — foi validada empiricamente antes de
substituir a denormalização: `EXPLAIN` sobre volume de seed mostrou 3ms, sem
sequer precisar do índice que já existe para outro propósito. Decidir com dado
em vez de suposição é o padrão que se repete no restante deste documento.

---

## Decisões técnicas

Resumo condensado. O registro completo — com alternativa descartada e
consequência para cada uma — está em [`specs/design.md`](./specs/design.md),
seção 3, decisões D-01 a D-16.

| # | Decisão | Resumo |
|---|---|---|
| D-01 | Vínculo separado de envio | Ver seção anterior |
| D-02 | Versão ativa garantida por índice único parcial no banco | `WHERE is_active AND deleted_at IS NULL` — a garantia não depende do código de aplicação |
| D-03 | Pendência derivada (`NOT EXISTS`), não denormalizada | Reversão registrada e validada por `EXPLAIN`, ver acima |
| D-04 | Quatro operações críticas, não seis | Ver [Atomicidade](#atomicidade) |
| D-05 | Propagação de transação explícita | `TransactionRunner` + `EntityManager` opcional no repositório, sem AsyncLocalStorage — assinatura auditável em vez de mágica |
| D-06 | Soft delete com defesa em profundidade | Índice parcial + filtro explícito em cada JOIN manual, nunca só um mecanismo central |
| D-07 | Re-vínculo cria novo registro | Não revive o vínculo antigo — evita fabricar intenção sobre o que aconteceu no intervalo |
| D-08 | Hierarquia de erros de domínio, discriminada por constraint | `ConcurrentSubmissionError` × `VersionConflictError`, nunca por mensagem de driver |
| D-09 | Dois percentuais de conformidade, nomeados sem ambiguidade | Ver [Estatísticas](#estatísticas) |
| D-10 | Arquitetura de módulos por comunicação via services públicos | `statistics` é a única exceção declarada, por ser leitura agregada — ver [Arquitetura](#arquitetura) |
| D-11 | Configuração de banco só muda por migration | `synchronize: false` em todo ambiente, inclusive dev |
| D-12 | `deletion_cause` amarrado por `CHECK` | `MANUAL` / `TYPE_REMOVED` / `EMPLOYEE_REMOVED`, nunca nulo quando `deleted_at` existe |
| D-13 | Remoção de envio ativo não reativa a versão anterior | Reenvio é sempre uma decisão explícita do chamador, nunca um efeito colateral do delete |
| D-14 | Tabela `constraint → erro` centralizada em `shared` | Um ponto de tradução, usado pelo service e como rede no exception filter |
| D-15 | Ordenação determinística em toda listagem | Nenhum item aparece em duas páginas nem some de todas |
| D-16 | Contratos de rota seguem posse do agregado | `employee-documents` é dono do vínculo e das submissões — nada fora dele cria uma submission |

---

## Operação e garantias

### Versionamento com histórico

Reenvio desativa a versão anterior e insere uma nova, dentro da mesma
transação. O número da próxima versão é `MAX(version) + 1` sobre **todas** as
submissões do vínculo — ativas ou não — nunca calculado a partir só da ativa.
É o que garante que remover um envio e enviar de novo não reaproveita número
já emitido.

### Atomicidade

| # | Operação | Invariante |
|---|---|---|
| 1 | Vinculação em lote | Todos os vínculos ou nenhum |
| 2 | Envio / reenvio | Nunca dois ativos, nunca buraco de versão |
| 3 | Remoção de colaborador | Propaga aos vínculos sem deixar órfão ativo |
| 4 | Remoção de tipo | Idem, com `deletion_cause = TYPE_REMOVED` |

**Não críticas** — escrita única de linha, sem invariante entre registros:
cadastro de colaborador e de tipo, desvinculação, remoção de envio ativo. A
classificação original listava seis operações como críticas; duas foram
reclassificadas ao aplicar o mesmo rigor usado na reversão de D-03 — superlistar
demonstra tão pouca discriminação quanto sublistar, e o enunciado pede
justamente discriminação.

### Soft delete

Nunca há remoção física — reforçado por regra de lint, não só por convenção
(`no-restricted-syntax` bloqueia `.remove()` e `DELETE FROM` no build).

Toda unicidade convive com remoção lógica via índice parcial
(`WHERE deleted_at IS NULL`), e toda consulta com JOIN manual repete o filtro
de `deleted_at` explicitamente — o filtro automático do TypeORM cobre apenas o
alias principal do QueryBuilder, nunca joins escritos à mão. É o ponto onde o
requisito vaza silenciosamente se não for repetido em cada lugar.

Remoção em cascata (colaborador ou tipo) registra a causa em
`deletion_cause`, distinguindo-a de desvinculação manual — sem isso, restaurar
seletivamente depois de uma cascata seria impossível de fazer com segurança.

### Tratamento de concorrência

A garantia mora no banco, não no código de aplicação: o índice único parcial
de D-02 faz o segundo de dois reenvios simultâneos falhar por violação de
unicidade, traduzida em `409 Conflict`. Nenhum lock pessimista, nenhuma fila.

Dois erros distintos, discriminados por **nome da constraint**, nunca por
mensagem de driver: `ConcurrentSubmissionError` (corrida legítima) e
`VersionConflictError` (bug de cálculo de versão). No caso degenerado de duas
inserções de primeiro envio colidindo ao mesmo tempo, as duas constraints são
violadas pela mesma escrita e qual o Postgres reporta primeiro não é contrato
documentado — os testes desse caso aceitam qualquer um dos dois, deliberadamente.

**Nota de metodologia de teste:** `Promise.all` simples não garante
sobreposição real de transação sob execução rápida em `READ COMMITTED` — um
teste de concorrência que dependa só disso pode passar pelo motivo errado.
Os testes de corrida aqui usam barreira explícita (conexões próprias, `BEGIN`
manual, sincronização do ponto de overlap).

### Estatísticas

"Percentual de documentação completa" admite duas leituras numericamente
diferentes — expor as duas, nomeadas sem ambiguidade, em vez de escolher uma
silenciosamente:

- `documentsSubmittedPercentage` — documentos entregues sobre o total exigido
- `employeesFullyCompliantPercentage` — colaboradores com 100% entregue, sobre
  os que têm ao menos uma obrigação (quem não tem nenhuma fica fora do
  denominador, não conta como conforme por vacuidade)

Agregação sempre em SQL, nunca reduzida em memória. Toda divisão usa
`NULLIF` no denominador — banco vazio retorna `0`, não erro.

---

## Estratégia de testes

```
Playwright (E2E)        →  fluxos completos via HTTP, contra o docker compose
Jest + Testcontainers   →  repositórios, transações, concorrência, soft delete
Jest (unit)              →  regras de domínio puras, mapeamento de erros
```

Cobertura na conclusão: <!-- VERIFICAR: contagem final de suítes/testes por camada -->.

---

## Processo de desenvolvimento

O projeto foi conduzido por especificação antes de código — não como
formalidade, mas porque o custo de corrigir um erro de modelagem em texto é
minutos; o mesmo erro descoberto em código já escrito custa reescrever commits.

```
specs/requirements.md   → o quê o sistema faz (critérios em notação EARS)
specs/design.md         → como (modelagem, decisões D-##, contratos)
specs/tasks.md          → em que ordem (tasks atômicas, rastreáveis a REQ)
```

Cada task carrega nível de prioridade — P0 é o que o enunciado declara como
critério de avaliação, nunca cortado — módulo dono, dependências, critério de
aceite verificável e o teste que o prova. Nenhuma linha de código foi escrita
sem uma task correspondente aprovada.

**Commits.** Conventional Commits, escopo por módulo, uma task por commit. O
histórico é 129 commits incrementais, sem squashing, sem `--amend` em commit já
enviado — o histórico é parte do entregável, não só metadado.

---

## O que ficou de fora e por quê

Nenhuma task foi descartada até o momento — `specs/tasks.md` não tem entradas
marcadas `[~]`. Esta seção será preenchida se isso mudar.

---

## Como o projeto foi construído com Claude Code

O desenvolvimento foi conduzido via [Claude Code](https://claude.com/claude-code)
seguindo a skill `spec-flow`, versionada em `.claude/skills/spec-flow/` — de
propósito, não por acidente do `.gitignore` (ver nota no topo deste repositório).
A skill governa a cadeia de specs descrita em
[Processo de desenvolvimento](#processo-de-desenvolvimento): `requirements.md` só
é seguido de `design.md`, e este só de `tasks.md`, cada um aprovado antes do
próximo ser escrito — nenhuma decisão de modelagem é tomada no meio do código.
Ela também define o loop de execução por task (selecionar → reenunciar critério
de aceite → implementar só o escopo → testar → autorrevisar → commitar) e as
convenções de commit já citadas acima. `.claude/skills/spec-flow/` é parte da
entrega, não uma ferramenta descartável — mostra como o trabalho foi conduzido,
não só o resultado dele.

---

## O que mudaria em produção

O que segue não é lacuna deste projeto — é escopo fora do que o desafio pediu.
Registrado para mostrar até onde o raciocínio foi levado.

### Autenticação e autorização

O enunciado dispensa explicitamente. Em produção: JWT ou OAuth2 na borda, com
papéis (RH edita, gestor consulta, auditor só lê). Nenhuma decisão deste
projeto entra em conflito com adicionar isso depois — nenhum endpoint hoje
assume identidade do chamador.

### Multi-tenancy

Se a mesma instância passar a atender múltiplos clientes: a rota mais simples
é uma coluna `tenant_id` propagada a cada tabela, presente em todo índice
parcial que hoje garante unicidade — `uq_submission_active` passaria a ser
`(tenant_id, employee_document_id)`, por exemplo. Schema-per-tenant dá
isolamento mais forte, mas complica migration e monitoramento em escala; para
o volume que este domínio sugere, `tenant_id` compartilhado com índice
composto é o ponto de partida mais barato de reverter se a decisão se mostrar
errada depois.

### Processamento assíncrono para cascatas grandes

Remover um tipo de documento vinculado a muitos colaboradores hoje é N updates
em uma única transação — aceitável no volume avaliado, mas uma transação que
prende milhares de linhas por segundos é o tipo de coisa que declara
indisponibilidade sob carga real. Evolução natural: outbox pattern — a
transação grava só a intenção, um worker assíncrono processa a propagação em
lotes menores.

### Agregações pré-computadas

As estatísticas hoje calculam ao vivo, o que é a escolha certa enquanto o
custo é 3ms. Em volume maior: view materializada atualizada por evento, ou uma
tabela de contadores incrementada a cada submissão — trocando simplicidade por
latência previsível sob carga alta de leitura.

### Particionamento

`document_submissions` cresce sem limite natural — nunca há remoção física.
Particionamento por intervalo de tempo (ou por tenant, se multi-tenant) adiaria
o dia em que índices deixam de caber confortavelmente em memória.

### Observabilidade

Logs estruturados com `requestId` já existem. Produção pediria métricas
(latência por rota, taxa de erro por tipo) e tracing distribuído — hoje
desnecessário porque não há chamada a serviço externo nenhum.

### Upload real de arquivo

O enunciado pede representação lógica apenas. Evolução natural: `submission`
passa a guardar uma referência a objeto em storage compatível com S3, não o
binário — o modelo de versionamento já suporta isso sem mudança de forma,
porque `DocumentSubmission` já é o registro de "um envio aconteceu", não o
arquivo em si.

### CI/CD

Hoje a suíte roda local. Pipeline automatizado — lint, build, unit,
integração contra Postgres efêmero — a cada abertura de PR é o próximo passo
óbvio, sem exigir mudança de nenhuma decisão já tomada aqui.

### Leitura em réplica

Listagem de pendentes e estatísticas são leitura pesada e toleram alguma
defasagem. Direcioná-las a uma réplica de leitura, mantendo escrita no
primary, escala sem tocar em nenhuma das garantias transacionais já
descritas — porque nenhuma delas depende de leitura consistente com a última
escrita no mesmo request.

---

## Licença

Não aplicável — projeto marcado `"license": "UNLICENSED"` em `package.json`;
não há arquivo `LICENSE` no repositório. É um teste técnico, não destinado a
distribuição.