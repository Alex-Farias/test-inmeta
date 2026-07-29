# Padrão de specs

Padrão adotado: **três artefatos em markdown puro (requirements / design / tasks) com
critérios de aceite em notação EARS.**

Formato popularizado pelo Kiro (AWS) e alinhado ao fluxo do GitHub Spec Kit, mas sem
ferramenta ou CLI acoplada — são arquivos versionados no próprio repositório. EARS é
vendor-neutral (criada por Alistair Mavin na Rolls-Royce, 2009) e existe muito antes das
ferramentas de IA que a adotaram.

Por que este padrão para este projeto:

- **Sem tooling extra.** O desafio já tem stack definida; adicionar um CLI de specs é
  superfície para explicar sem retorno.
- **EARS gera nome de teste.** Um critério bem escrito vira o `it(...)` quase literalmente.
  Isso fecha a rastreabilidade requisito → task → teste → commit.
- **`design.md` é rascunho do README.** As seções de modelagem e trade-offs migram
  direto para a entrega final.

---

## 1. `requirements.md`

Descreve **o que** o sistema faz. Nunca menciona classe, tabela, biblioteca ou endpoint —
isso é `design.md`.

Estrutura por requisito:

```markdown
### REQ-07 — Reenvio de documento com versionamento

**História:** Como gestor de RH, quero reenviar um documento já entregue,
para corrigir um envio anterior sem perder o registro do que foi enviado antes.

**Critérios de aceite:**

1. QUANDO um documento é enviado para um vínculo sem envio anterior,
   o sistema DEVE registrar o envio como versão 1 e marcá-lo como ativo.
2. QUANDO um documento é reenviado para um vínculo que já possui envio ativo,
   o sistema DEVE desativar o envio anterior e registrar o novo com a versão incrementada.
3. O sistema DEVE manter permanentemente acessíveis todas as versões anteriores de um envio.
4. EM QUALQUER MOMENTO, um vínculo DEVE possuir no máximo um envio ativo.
5. SE dois reenvios do mesmo vínculo forem processados concorrentemente,
   ENTÃO o sistema DEVE persistir apenas um deles e rejeitar o outro com conflito.
```

### EARS — os cinco padrões

| Tipo | Forma | Uso |
|---|---|---|
| Ubíquo | `O sistema DEVE <resposta>` | Invariante sempre válido |
| Dirigido a evento | `QUANDO <gatilho>, o sistema DEVE <resposta>` | Reação a uma ação |
| Dirigido a estado | `ENQUANTO <estado>, o sistema DEVE <resposta>` | Comportamento condicionado a estado |
| Opcional | `ONDE <funcionalidade presente>, o sistema DEVE <resposta>` | Recurso condicional |
| Comportamento indesejado | `SE <condição indesejada>, ENTÃO o sistema DEVE <resposta>` | Erro, conflito, violação |

Por que a forma constrangida importa: ela força a explicitar o gatilho e a resposta
separadamente. "O sistema gerencia versões de documentos" não gera teste. "QUANDO um
documento é reenviado, o sistema DEVE desativar o envio anterior" gera dois.

### Regras

- Um `REQ-##` por comportamento observável. Numeração estável — nunca renumerar após
  existirem tasks apontando para ele.
- Todo critério é verificável por alguém que não escreveu o código.
- Requisitos não-funcionais (atomicidade, soft delete, paginação) ganham `REQ` próprio.
  São eles que carregam o peso da avaliação — não podem ficar implícitos dentro de outro.
- Sem "deveria", "idealmente", "se possível". Ou é requisito, ou não está no arquivo.

---

## 2. `design.md`

Descreve **como**. Toda decisão relevante registra a alternativa descartada e o motivo —
essa é a parte que migra para o README e é o que está sendo avaliado.

Seções obrigatórias:

1. **Modelo de dados** — entidades, relacionamentos, diagrama, e a justificativa da
   separação vínculo × submission.
2. **Arquitetura** — módulos, responsabilidades, regra de acoplamento, estrutura de pastas.
3. **Decisões e trade-offs** — uma subseção por decisão, no formato abaixo.
4. **Contratos de API** — endpoints, formatos de request/response, códigos de erro.
5. **Estratégia de testes** — o que cada camada cobre.
6. **Rastreabilidade** — tabela `REQ-##` → seção de design que o atende.

Formato de decisão:

```markdown
### D-04 — Fonte de verdade da versão ativa

**Contexto:** REQ-07 exige no máximo um envio ativo por vínculo, com histórico preservado.

**Decisão:** flag `is_active` na submission, garantida por índice único parcial no banco.

**Alternativa descartada:** ponteiro `current_submission_id` no vínculo — exige a mesma
transação e não impede dois ativos em caso de escrita concorrente.

**Consequência:** a garantia deixa de depender do código de aplicação. Reenvio concorrente
vira violação de unicidade (`23505`), traduzida em HTTP 409. Resolve REQ-07.4 e REQ-07.5
com um único objeto de schema.
```

---

## 3. `tasks.md`

Descreve **em que ordem**. É o arquivo vivo do projeto — atualizado a cada commit.

```markdown
## Fundação

- [x] **TASK-003** · P0 · `db` · configurar typeorm com data source e migrations
  - Requisitos: REQ-00
  - Depende de: TASK-001, TASK-002
  - Aceite: `npm run migration:run` aplica a migration inicial em banco limpo
  - Teste: verificação manual documentada no README
  - Commit: `a3f9c21`

## Envio e versionamento

- [ ] **TASK-014** · P0 · `submissions` · garantir versao ativa unica via indice parcial
  - Requisitos: REQ-07.4
  - Depende de: TASK-013
  - Aceite: tentativa de inserir segundo envio ativo para o mesmo vínculo falha no banco
  - Teste: `submissions.repository.integration.spec.ts` → "rejeita segundo envio ativo"
```

### Regras de decomposição

**Quebre por fatia vertical, não por camada.** "Criar todos os DTOs" é uma task horizontal:
não entrega comportamento, não tem critério de aceite verificável e produz um commit que
não significa nada no histórico.

**Uma operação crítica é sempre uma task própria.** Envio com versionamento, vínculo em
lote, soft delete de colaborador e desvínculo carregam invariantes transacionais — cada uma
merece commit e teste isolados, porque cada uma é evidência direta de um critério de
avaliação.

**"Título com 'e' ligando dois verbos" é gatilho de verificação, não quebra automática.**
Título composto não é o mesmo que task não-atômica. Mantenha as duas metades unidas quando
satisfazem **as quatro** condições: **mesma entidade**, **mesmo módulo**, **no máximo três
asserções** combinadas, e **mesma natureza de preocupação**. Quebrar pares de CRUD trivial do
mesmo módulo produz commits que não significam nada isoladamente — o oposto do que a regra
existe para conseguir.

A quarta condição é a que impede o excesso oposto. Duas metades podem ser da mesma entidade e
do mesmo módulo e ainda assim merecer commits separados quando tratam de preocupações
diferentes — observabilidade e segurança, por exemplo, ou uma com teste automatizado e outra
com verificação manual. Sem ela, a regra reconsolidaria na varredura seguinte tudo que a
revisão anterior separou por bom motivo.

**Teste de invariante é task separada da feature.** `TASK-013` implementa o envio;
`TASK-014` prova que a constraint segura. Separar dá dois commits legíveis em vez de um
commit grande, e deixa a evidência visível no histórico.

**Migration acompanha a entidade que a exige**, na mesma task. Schema e código que dependem
dele nunca ficam em commits diferentes — isso quebra o build em qualquer checkout do meio.

### Ordem de execução

Dentro do mesmo nível de prioridade, ordene por dependência técnica, não por conveniência.
Entre níveis, P0 primeiro — sempre. Ver a tabela de níveis no SKILL.md.

### Manutenção

- Task concluída é marcada com `[x]` e ganha o hash curto do commit.
- Task descoberta durante a execução entra no fim do nível apropriado, nunca vira código
  extra no commit atual.
- Task descartada não é apagada: vira `[~]` com uma linha de justificativa. Ela alimenta a
  seção "o que ficou de fora e por quê" do README, que o enunciado cobra explicitamente.

---

## Alternativas consideradas

Registrado para o caso de o padrão precisar mudar:

| Padrão | Por que não aqui |
|---|---|
| **GitHub Spec Kit** (`constitution` / `specify` / `plan` / `tasks` / `implement`) | O fluxo mais adotado e portável entre agentes, mas adiciona um CLI Python e gera volume de markdown desproporcional para um projeto de um módulo. A crítica recorrente — "mar de markdown" para features pequenas — se aplica diretamente aqui |
| **BMAD-METHOD** | Orquestração multiagente com papéis (PM, arquiteto, dev, QA). Desenhado para times e produtos longos; overhead sem retorno para um dev único |
| **OpenSpec / spec-as-source** (Tessl e similares) | Trata a spec como fonte da qual o código é regenerado. Interessante, mas inverte a relação que este projeto precisa: aqui o código é a entrega avaliada |
| **ADR puro** (Architecture Decision Records) | Ótimo para decisões, mas não cobre decomposição em tasks nem critérios de aceite. Está absorvido: o formato `D-##` do `design.md` é um ADR enxuto |
| **Gherkin / BDD puro** (Given-When-Then) | Excelente para aceite, porém direcionado a cenário executável (Cucumber). EARS entrega o mesmo rigor sem exigir runner adicional |
