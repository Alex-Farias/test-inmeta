---
name: spec-flow
description: Fluxo spec-driven para o projeto de API de gestão de documentação de colaboradores (Nest.js + TypeScript + PostgreSQL + TypeORM). Use SEMPRE que o trabalho tocar este projeto — ao inicializar o repositório, escrever ou revisar specs, quebrar requisitos em tasks atômicas, escolher a próxima task, implementar qualquer módulo (employees, document-types, employee-documents, submissions, statistics), escrever migration, tratar transação, soft delete, versionamento de documentos, concorrência, estatísticas, testes ou commits, e ao fechar a entrega. Acione também em pedidos como "vamos começar o projeto", "qual a próxima task", "implementa o envio de documento", "revisa antes de commitar", "monta o README final" — mesmo que specs não sejam mencionadas explicitamente.
---

# Spec Flow — API de Documentação de Colaboradores

Fluxo de trabalho para conduzir este projeto do repositório vazio até a entrega,
mantendo rastreabilidade entre requisito, task, commit e teste.

## Princípio

O que está sendo avaliado neste projeto é **julgamento técnico**, não volume de features.
O escopo funcional é CRUD simples; o peso está em versionamento com histórico, atomicidade
e soft delete consistente. Por isso:

- Decisão consciente documentada vale mais que feature extra.
- Escopo menor bem executado vence escopo maior frágil.
- O README é entregável de primeira classe, não resumo.

Traduzindo para o fluxo: **nenhuma linha de código antes de existir uma task com critério
de aceite verificável**, e nenhuma task sem rastreabilidade para um requisito — salvo as de
origem **"Entrega / fechamento"**, cuja categoria de origem *é* a rastreabilidade, porque o
que elas atendem são propriedades da entrega e não comportamento do sistema. Ver "Restrições
de entrega" em `specs/requirements.md`.

## Padrão de specs

Três artefatos em `specs/`, nesta ordem de dependência:

```
specs/
├── requirements.md   # O QUE o sistema faz — critérios em notação EARS
├── design.md         # COMO — modelagem, arquitetura, decisões e trade-offs
└── tasks.md          # EM QUE ORDEM — tasks atômicas, priorizadas, rastreáveis
```

Cada artefato só é escrito depois que o anterior foi aprovado pelo humano. Isso não é
burocracia: erro de modelagem corrigido em `design.md` custa um minuto, corrigido no código
custa uma tarde.

Leia `references/spec-standard.md` antes de escrever ou revisar qualquer um dos três.
Os templates estão em `assets/`.

## Níveis de prioridade

Toda task carrega um nível — **P0** critério de avaliação declarado · **P1** escopo funcional
obrigatório · **P2** diferencial declarado · **P3** melhoria opcional.

O nível define **peso de avaliação**, não cortabilidade. Três coisas vivem em `specs/tasks.md`
e são autoridade sobre este arquivo:

| Pergunta | Onde está a resposta |
|---|---|
| Que nível uma task recebe | Seção **"Mapeamento origem → nível"** — deriva da origem do requisito em `requirements.md`, não de julgamento caso a caso |
| O que dá para cortar | Seção **"Corte é transitivo"** — cortar uma task implica cortar todas que dependem dela. Uma P1 ou P2 com dependentes P0 é inegociável, e a seção traz a lista das que de fato podem sair |
| Em que ordem executar | Seção **"Ordem de execução e suas três exceções"** |

Regra de sequência: **P0 de um módulo antes de P1 de outro.** Um vínculo sem transação é
dívida; um Swagger ausente é um parágrafo no README. As **três** exceções — fundação,
propagação de remoção e fechamento — estão declaradas em `tasks.md`, com o motivo de cada uma.

## Atomicidade de task

Uma task é atômica quando **cabe em um commit que compila e passa os testes**. Se não cabe,
não é uma task — é um épico disfarçado, e precisa ser quebrado antes de começar.

Toda task tem obrigatoriamente **dez elementos**:

- **Marcador** de situação (`[ ]` `[x]` `[~]` `[>]` — legenda na seção Manutenção de `tasks.md`)
- **ID** sequencial (`TASK-014`)
- **Nível** (P0–P3)
- **Módulo dono** — a task não escreve em módulo que não é dela, exceto `shared`
- **Título** no imperativo, minúsculo, no mesmo formato da mensagem de commit
- **Rastreabilidade** para um ou mais requisitos (`REQ-07`) — **ou** uma linha `Origem:`,
  para tasks de origem "Entrega / fechamento", que não mapeiam para `REQ`
- **Dependências** por ID
- **Critério de aceite verificável** — copiado do requisito, não reescrito
- **Teste** que prova o critério, no mesmo commit ou no imediatamente seguinte
- **Commit** — tipo e escopo (`test(submissions)`); entregável só de verificação recebe `test`

Sinais de que a task não é atômica:

- Toca dois módulos donos
- O critério de aceite tem mais de três asserções independentes
- Você não consegue nomear o teste que a prova
- O título tem "e" ligando dois verbos — **gatilho de verificação, não quebra automática.**
  Este sobre-dispara e já produziu quebras excessivas que precisaram ser revertidas. As quatro
  condições que decidem entre quebrar e manter unido estão em `references/spec-standard.md`;
  leia-as antes de quebrar por este sinal.

## Fase 1 — Início

Executar uma vez, no repositório vazio.

1. **Ler as decisões travadas.** `specs/design.md`, §3. Elas não são
   sugestões: modelagem, estratégia de versão ativa, propagação de transação e semântica de
   soft delete já foram decididas e justificadas. Implemente, não redecida. Se algo ali
   parecer errado, **levante com o humano antes de divergir** — não silenciosamente.

2. **Escrever `specs/requirements.md`.** Derivado do enunciado do desafio. Critérios em
   EARS. Parar e pedir aprovação.

3. **Escrever `specs/design.md`.** Absorve as decisões travadas, adiciona o que faltar,
   registra os trade-offs com a alternativa descartada e o porquê. Parar e pedir aprovação.

4. **Escrever `specs/tasks.md`.** Quebra completa, priorizada, com dependências. Parar e
   pedir aprovação. **Este é o portão: nenhum código antes daqui.**

5. **Fundação.** Só então executar as tasks de infra: Nest, docker-compose com Postgres,
   TypeORM, migration inicial com os índices parciais, hierarquia de erros, exception
   filter, `TransactionRunner`, health check, validação de env.

Entregável da fase: o projeto sobe, migra e responde `/health`, com specs aprovadas no
repositório.

## Fase 2 — Meio (loop de execução)

Repetir por task. **Uma task por vez.** Nunca começar a próxima antes de commitar a atual.

1. **Selecionar.** A primeira task `[ ]` **na ordem em que aparece em `tasks.md`** cujas
   dependências estejam todas concluídas. **Não** por menor ID: IDs são identificadores
   estáveis e não refletem ordem de execução — tasks descobertas depois recebem o próximo ID
   livre e são posicionadas onde a dependência manda. Anunciar qual e por quê antes de tocar
   em arquivo.
2. **Reenunciar o critério de aceite** com suas palavras. Se não conseguir, a task está mal
   escrita — corrija `tasks.md` primeiro.
3. **Planejar.** Arquivos que serão criados ou alterados, e o nome do teste que vai provar o
   critério. Apresentar o plano antes de escrever código.
4. **Implementar** só o escopo da task. Melhoria adjacente que você notou vira `TASK-###`
   nova em `tasks.md`, não código extra neste commit.
5. **Testar.** Rodar de fato, colar a saída. Teste prometido não conta.
6. **Autorrevisar** com o checklist de `references/convencoes.md` antes de propor o commit.
   O item de soft delete em JOIN é o que mais falha.
7. **Commitar** no padrão de `references/convencoes.md`.
8. **Atualizar `tasks.md`**: marcar concluída, registrar o hash curto do commit.

Se durante a implementação aparecer uma decisão que `design.md` não cobre: **pare e
pergunte.** Decisão tomada no meio do código sem registro é exatamente o que o projeto está
tentando evitar — e é a que ninguém consegue defender depois.

## Fase 3 — Fim

Executar quando todas as tasks P0 e P1 estiverem concluídas.

1. **Varredura de soft delete.** Percorrer o checklist completo em
   `references/convencoes.md`, item por item, confirmando no código. É o critério mais
   destacado no enunciado e o mais fácil de furar silenciosamente.
2. **Auditoria de rastreabilidade.** Todo `REQ-##` tem task concluída ou justificativa
   registrada de não implementação. Requisito órfão é bug de processo.
3. **Rodar a suíte completa** e reportar cobertura por camada.
4. **Gerar o README** a partir de `requirements.md` + `design.md`, seguindo a estrutura em
   `references/convencoes.md`. Inclui obrigatoriamente a seção "o que ficou de fora e por
   quê", alimentada **apenas pelas tasks `[~]`** — descartadas. Tasks `[>]` foram realocadas
   ou consolidadas e **executadas sob outro ID**: colocá-las ali diria que não foram feitas.
   A legenda dos marcadores está na seção Manutenção de `specs/tasks.md`.
5. **Revisar o histórico de commits** (`git log --oneline`). Ele deve contar a evolução do
   sistema de forma legível para quem nunca viu o projeto.
6. **Validar em clone limpo.** `git clone` em diretório novo, seguir o README ao pé da
   letra, subir e migrar. Funcionar na máquina onde foi construído não prova nada.

## Portões

Não atravesse estes pontos sozinho:

- `requirements.md` → `design.md` → `tasks.md`: cada um exige aprovação explícita.
- Primeira linha de código: exige `tasks.md` aprovado.
- Divergir de uma decisão travada: exige levantar antes.
- Decisão nova não coberta por `design.md`: exige perguntar.

## O que não delegar

Estes itens são o que está sendo avaliado no humano. A skill não os produz sozinha:

- **Trade-offs.** Se o humano não consegue defender a escolha, ela não vale.
- **Revisão de diff.** Código não revisado é passivo, não entrega.
- **O README final.** Precisa soar como quem assina e ser defensável linha a linha.

O commit é assinado por quem responde pela mudança. Isso é verdadeiro quando o diff foi
revisado e cada decisão é defensável sem consulta. Não anexe trailers de coautoria — ver
`references/convencoes.md`.

## Arquivos de referência

| Arquivo | Quando ler |
|---|---|
| `references/spec-standard.md` | Antes de escrever ou revisar qualquer spec; ao quebrar requisito em task |
| `specs/design.md` | Antes de qualquer implementação de domínio, migration ou consulta. §3 traz as decisões D-01..D-16; §5, a estratégia de testes; §2, a estrutura de pastas |
| `references/convencoes.md` | Antes de commitar; na autorrevisão; na fase de fechamento |
| `assets/requirements.template.md` | Fase 1, passo 2 |
| `assets/design.template.md` | Fase 1, passo 3 |
| `assets/tasks.template.md` | Fase 1, passo 4 |
