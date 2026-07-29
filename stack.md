# Stack

Escolhas de tecnologia e justificativa. Modelagem de dados, arquitetura de módulos e
contratos de API **não** entram aqui — são `specs/design.md`.

As versões abaixo foram resolvidas contra o registro em 2026-07-28 e são as que serão
fixadas no `package.json`. Onde a versão mais recente **não** foi escolhida, o motivo está
registrado.

---

## Resumo

| Camada | Escolha | Versão fixada |
|---|---|---|
| Runtime | Node.js (linha LTS 24) | `24.16.0` |
| Linguagem | TypeScript | `5.9.3` |
| Framework | Nest.js | `11.1.28` |
| Banco | PostgreSQL | `18-alpine` |
| ORM | TypeORM | `1.1.0` |
| Driver | node-postgres (`pg`) | `8.22.0` |
| Testes (unit/integração) | Jest + ts-jest | `30.4.2` / `29.4.12` |
| Banco real em teste | Testcontainers | `12.0.4` |
| Testes E2E | Playwright (`APIRequestContext`) | `1.62.0` |
| Validação | class-validator + class-transformer | `0.15.1` / `0.5.1` |
| Documentação | @nestjs/swagger | `11.4.6` |
| Logs | nestjs-pino + pino | `4.6.1` / `10.3.1` |
| Health check | @nestjs/terminus | `11.1.1` |
| Configuração | @nestjs/config | `4.0.4` |

Framework, banco, ORM, ferramentas de teste, validação, documentação e logs vêm de
`specs/design.md` §3 e estão **travados**. O que este documento acrescenta é a
justificativa defensável, a alternativa descartada e a versão exata — mais as escolhas que
as decisões travadas não cobriam (runtime, versão de linguagem, driver, versão do banco).

---

## Runtime — Node.js 24.16.0

**Por quê.** O enunciado exige Node.js com TypeScript; a única decisão livre é a linha de
versão. A 24 é a LTS ativa e é o piso exigido pelo TypeORM 1.x, cujo campo `engines` declara
`^20.19.0 || ^22.13.0 || >=24.11.0`. Escolher 24 alinha runtime, ORM e imagem de container
sem faixa de compatibilidade para explicar.

**Alternativa descartada.** Node 22 — ainda em manutenção e igualmente suportado pelo ORM,
mas entra em fim de vida antes da 24 e não oferece nada que este projeto use. Ficar uma LTS
atrás sem motivo é dívida gratuita num teste cujo critério é "código pronto para produção".

**Como é fixado.** `.nvmrc`, campo `engines` no `package.json` e a tag da imagem base no
Dockerfile apontam para a mesma versão. Runtime divergente entre a máquina do avaliador e o
container é a forma mais boba de o projeto não subir em clone limpo.

---

## Linguagem — TypeScript 5.9.3

**Por quê.** É a versão que o próprio `@nestjs/cli@11.0.24` traz como dependência, ou seja,
a linha contra a qual o framework é testado. Nest, TypeORM e class-validator dependem todos
de `emitDecoratorMetadata` e decorators legados; alinhar com o que o framework valida elimina
uma classe inteira de problema de metadados que não tem relação com o desafio.

**Alternativa descartada — e este é o caso mais interessante do documento.** A versão
`latest` no registro hoje é a **7.0.2**, e a 6.0.3 também já é estável. Ambas foram
descartadas por uma incompatibilidade concreta, não por conservadorismo: `ts-jest@29.4.12`
declara peer `typescript: ">=4.3 <7"`. Adotar TypeScript 7 quebraria a camada de testes, que
é critério de avaliação explícito. Restaria trocar `ts-jest` por `@swc/jest`, o que perde a
checagem de tipos durante os testes — exatamente o que se quer manter num projeto cuja
proposta é rigor. A 6.0.3 caberia no peer range, mas o Nest CLI ainda entrega a 5.9.3; subir
um major à frente do framework adiciona risco sem entregar recurso que este código use.

**Regra que fica.** Não há ganho em usar a versão mais nova quando a cadeia de ferramentas
não a acompanha. A escolha aqui é da versão mais nova **coerente com todo o toolchain**.

---

## Framework — Nest.js 11.1.28

**Por quê (decisão travada, D-10).** O enunciado deixa o framework livre e avalia
explicitamente "separação entre camadas" e "modularização coerente sem acoplamento
desnecessário". O Nest é o único da lista sugerida que traz módulos, injeção de dependência
e um pipeline de interceptors/filters como estrutura de primeira classe. Isso importa
diretamente para dois pontos do desafio: o exception filter global que traduz `DomainError`
para HTTP sem controller lançar `HttpException`, e o `TransactionRunner` injetável que
propaga `EntityManager` — ambos saem do container de DI em vez de virarem convenção
combinada verbalmente.

**Alternativa descartada.** Express ou Fastify puros. Custam menos abstração e sobem mais
rápido, mas a estrutura de camadas passaria a ser convenção não verificável — e é
precisamente a estrutura que está sendo avaliada. O trabalho de montar módulos, DI e
tratamento centralizado de erro à mão reapareceria em forma menos legível para quem revisa
em vinte minutos.

**Custo assumido.** Boilerplate e decorators. Aceitável: o avaliador conhece o padrão, e o
código gasto em estrutura é código que ele não precisa inferir.

**Pacotes fixados.** `@nestjs/core`, `@nestjs/common`, `@nestjs/platform-express` em
`11.1.28`; `@nestjs/cli` `11.0.24`; `@nestjs/config` `4.0.4`; `reflect-metadata` `0.2.2`.
Plataforma HTTP: Express, o default do Nest — Fastify renderia throughput que este teste não
mede, em troca de divergências de integração com Swagger e Pino.

---

## Banco — PostgreSQL 18-alpine

**Por quê (decisão travada).** A escolha do banco é o que sustenta as decisões D-02 e D-06.
O requisito de "apenas a versão mais recente ativa" e o de unicidade convivendo com soft
delete são resolvidos por **índice único parcial** (`CREATE UNIQUE INDEX ... WHERE ...`),
recurso que o Postgres tem e a maioria das alternativas não. Isso move a garantia de
integridade do código de aplicação para o schema: reenvio concorrente vira violação `23505`,
não corrida perdida. Estatística agregada em SQL, com `NULLIF` e `FILTER`, também é terreno
natural dele.

**Alternativa descartada.** MySQL/MariaDB — não suportam índice parcial, o que forçaria
emular unicidade condicional com coluna gerada ou trigger, ou então mover a garantia para a
aplicação com lock pessimista. Seria trocar uma linha de DDL por um mecanismo que precisa ser
defendido e testado. MongoDB foi descartado por motivo mais forte: o núcleo do desafio é
integridade transacional entre entidades relacionadas, que é o que um banco relacional existe
para fazer.

**Versão.** 18 é a major estável atual. Nada no projeto exige recurso exclusivo dela — 17
serviria —, mas subir uma major em imagem descartável não tem custo, e a mesma tag é usada
em três lugares: `docker-compose`, Testcontainers e CI. Banco de teste divergente do banco
de desenvolvimento invalida justamente os testes de integração que carregam o peso da
avaliação.

---

## ORM — TypeORM 1.1.0

**Por quê (decisão travada).** Integração madura com Nest via `@nestjs/typeorm`,
`@DeleteDateColumn` como suporte nativo a soft delete, `DataSource.transaction()` como base
do `TransactionRunner`, e um QueryBuilder que permite descer a SQL quando a agregação exige —
sem largar o mapeamento de entidades.

**A ressalva honesta, e ela é grande.** `@DeleteDateColumn` filtra automaticamente **apenas
o alias principal** do QueryBuilder; joins escritos à mão não herdam o filtro. Como quase
toda consulta relevante deste sistema tem join, cada cláusula precisa repetir
`AND <alias>.deleted_at IS NULL` explicitamente. É a rota de vazamento silencioso do
requisito mais destacado do enunciado. A escolha do ORM foi feita **com** esse custo
conhecido, e ele é mitigado por convenção explícita e por item dedicado no checklist de
revisão, não por confiança no automatismo.

**Alternativa descartada.** Prisma — melhor ergonomia e tipagem superior, e teria evitado
justamente a armadilha acima. Descartado por duas razões concretas: índices parciais com
`WHERE` não são expressáveis no schema declarativo e exigiriam SQL bruto em migration
mesmo assim, e o controle fino de transação com propagação explícita de client é mais
áspero. Como as duas coisas que este desafio mais cobra são exatamente essas, o ORM com
melhor DX perderia nos dois pontos que importam. Knex/SQL puro foi descartado no sentido
oposto: resolveria tudo, ao custo de escrever mapeamento e ciclo de vida de entidade à mão.

**Sobre a versão — decisão que merece atenção.** A `latest` do registro é a `1.1.0`, e a
linha `0.3.31`, usada pela maioria dos projetos, está publicada sob a dist-tag `legacy`.
`@nestjs/typeorm@11.0.3` declara peer `typeorm: "^0.3.0 || ^1.0.0-dev"`, então a 1.x é
suportada oficialmente. Fixo a 1.1.0.

O risco real é documentação de terceiros e respostas de fórum ainda majoritariamente
escritas para a 0.3.x. Ele é aceitável aqui porque a superfície de API que este projeto usa
é pequena e estável entre as duas linhas — `DataSource`, `EntityManager`, `Repository`,
`QueryBuilder`, `@DeleteDateColumn` — e porque D-11 já determina que as migrations críticas
sejam SQL escrito à mão via `migration:create`, sem depender da geração automática, que é
onde as diferenças entre majors costumam doer. Fallback registrado, caso a 1.x apresente
atrito não previsto durante a fundação: `typeorm@0.3.31`, sem impacto em nenhuma decisão de
`design.md`.

**Driver.** `pg@8.22.0`, exigido como peer pelo TypeORM (`^8.5.1`).

---

## Testes — Jest 30.4.2 + Testcontainers 12.0.4 + Playwright 1.62.0

**Por quê três ferramentas e não uma.** Cada uma cobre o que as outras não alcançam:

| Camada | Ferramenta | Cobre | Não cobre |
|---|---|---|---|
| Unit | Jest | Regra de domínio pura, mapeamento de erro | Qualquer coisa que toque o banco |
| Integração | Jest + Testcontainers | Repositório, transação, concorrência, soft delete em join | Contrato HTTP |
| E2E | Playwright | Fluxo completo via HTTP contra o compose | Estado interno das tabelas, rollback |

A divisão não é preferência: os testes que carregam o peso da avaliação — dois reenvios
simultâneos com `Promise.all` resultando em exatamente uma submission ativa, e rollback de
vínculo em lote — **exigem** banco real e acesso direto ao `DataSource`. Mock de repositório
não prova constraint de banco; é teste que passa enquanto o sistema está quebrado.

**Jest.** Default do Nest, integração pronta com o `TestingModule`. Descartado Vitest: mais
rápido e com ESM melhor resolvido, mas exigiria ajustar o setup de decorators e metadados
que o Nest entrega funcionando — atrito de configuração sem retorno em critério avaliado.
Transformador: `ts-jest@29.4.12`, que preserva checagem de tipos durante os testes.
Descartado `@swc/jest`: mais rápido, porém apenas transpila, e perder erro de tipo no teste
contradiz a razão de usar TypeScript.

**Testcontainers.** Sobe um Postgres 18 descartável por suíte. Descartado banco de teste
compartilhado, via schema ou `.env.test`: exige estado limpo entre execuções, quebra em
paralelo e é a causa mais comum de teste que passa na máquina de quem escreveu e falha na
de quem avalia. Descartado também SQLite em memória — não tem índice parcial nem a mesma
semântica transacional, ou seja, não testaria nada do que precisa ser testado.

**Playwright** com `APIRequestContext`, sem browser. Descartado Supertest, que é a escolha
convencional em Nest: ele sobe a aplicação em processo, o que é mais rápido, mas testa a
aplicação e não o serviço — não exercita o `docker-compose`, nem migration aplicada, nem
o binding de rede. Como "funciona em clone limpo" é entregável, o E2E precisa bater na
porta HTTP real. Custo assumido: uma dependência a mais e a exigência de o compose estar
no ar para rodar essa suíte.

**Types.** `@types/jest@30.0.0`, `@types/node@26.1.2`.

---

## Validação — class-validator 0.15.1 + class-transformer 0.5.1

**Por quê (decisão travada).** É o que o `ValidationPipe` do Nest consome nativamente. DTO
decorado é validado na borda, antes de qualquer service, com `whitelist` e
`forbidNonWhitelisted` ativos para que campo desconhecido seja rejeitado em vez de ignorado
em silêncio. O mesmo decorator alimenta o gerador de schema do Swagger, então contrato
documentado e contrato validado não divergem — não há segunda fonte de verdade para manter.

**Alternativa descartada.** Zod (`4.4.3`), que tem inferência de tipo superior e é hoje a
escolha mais moderna. Descartado porque em Nest exige pipe customizado e, principalmente,
porque quebraria a ligação automática entre DTO e Swagger, forçando descrever o contrato
duas vezes. Duplicar contrato num projeto avaliado por consistência é o trade-off errado.

**Nota de escopo.** Validação de formato fica aqui, na borda. Regra de negócio não —
vínculo duplicado, envio para vínculo removido e afins são erro de domínio, decididos no
service e traduzidos pelo filter (D-08). A fronteira entre as duas está registrada em
`design.md`, não neste documento.

---

## Documentação — @nestjs/swagger 11.4.6

**Por quê (decisão travada, diferencial do enunciado).** Gera OpenAPI a partir dos mesmos
decorators que já validam o request. O custo marginal é baixo justamente porque a validação
já foi decidada por decorator, e o retorno é uma superfície navegável para o avaliador
exercitar a API sem ler o código antes.

**Alternativa descartada.** Escrever o OpenAPI à mão ou uma coleção de requisições
versionada. Ambos divergem do código no primeiro refactor, e documentação desatualizada é
pior que documentação ausente.

**Escopo.** Documenta contrato de request/response e o catálogo de códigos de erro. O
formato do payload de erro é D-08 e vive em `design.md`.

---

## Logs — nestjs-pino 4.6.1 + pino 10.3.1

**Por quê (decisão travada, diferencial do enunciado).** JSON estruturado por padrão, com
overhead baixo o bastante para ficar ligado em produção. O que motiva a escolha neste
projeto em particular é o `request-id` correlacionado: D-08 exige que o payload de erro
carregue um `requestId`, e que erro não mapeado gere log com stack e o mesmo id. O
`nestjs-pino` propaga esse id automaticamente para todo log emitido dentro da requisição,
de modo que a resposta que o avaliador vê no cliente e a linha de log no terminal se
encontram por um campo. Sem isso, `requestId` é enfeite no JSON.

**Alternativa descartada.** O `Logger` embutido do Nest — zero dependência, mas emite texto
formatado para humano, sem estrutura, sem correlação e sem redação de campo sensível. Não
atende ao diferencial "logs estruturados". Winston foi descartado por ser mais configurável
e mais lento, sem entregar nada que este projeto precise.

**Desenvolvimento.** `pino-pretty@13.1.3` como transport apenas fora de produção. Descartado
deixá-lo sempre ativo: log legível por humano em produção é log que nenhum coletor indexa.

---

## Health check — @nestjs/terminus 11.1.1

**Por quê (diferencial do enunciado).** `/health` que verifica conectividade real com o
Postgres, não um `200 OK` fixo. Endpoint que responde saudável com o banco fora é pior que
não ter endpoint — informa errado exatamente no momento em que alguém consulta.

**Alternativa descartada.** Um controller de três linhas retornando `{ status: 'ok' }`.
Mais barato, mas não prova nada sobre a dependência que efetivamente falha.

---

## Qualidade de código

| Ferramenta | Versão | Papel |
|---|---|---|
| ESLint | `10.8.0` | Regras de lint |
| typescript-eslint | `8.65.0` | Regras cientes de tipo |
| Prettier | `3.9.6` | Formatação, sem discussão de estilo em revisão |

O enunciado avalia "estilo de codificação consistente em toda a base". Formatação
automatizada é a forma barata de garantir isso; conferi-la em revisão manual é desperdício
de atenção do revisor.

---

## O que foi deliberadamente deixado de fora

| Não adotado | Por quê |
|---|---|
| Autenticação / autorização | O enunciado diz explicitamente que não será avaliado e não deve consumir foco |
| Cache (Redis) | D-09 fixa agregação em SQL sem cache. Em volume maior viraria view materializada — registrado no README, não implementado |
| Upload de arquivo / storage | O enunciado pede representação lógica do envio, não o arquivo físico |
| Fila / worker | Nenhuma operação do escopo é assíncrona. A propagação de soft delete de tipo é a única candidata futura, e cabe numa transação neste volume |
| `typeorm-transactional` | D-05 o descarta: funciona via AsyncLocalStorage, mas esconde o limite transacional de quem revisa em vinte minutos |
| Supertest | Substituído por Playwright contra o compose, pelo motivo registrado na seção de testes |
| Zod | Substituído por class-validator, pelo motivo registrado na seção de validação |
