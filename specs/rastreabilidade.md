# Auditoria de rastreabilidade — requisito → task

TASK-074, fase de fechamento. Verifica a propriedade que o `spec-flow` chama de portão:
**todo `REQ-##` tem task concluída ou justificativa registrada de não implementação**.
Requisito órfão é bug de processo — não porque a funcionalidade falte, mas porque ninguém
consegue provar que ela existe sem reler o código inteiro.

Material para o README (TASK-075), que é escrito à parte.

---

## Método

Extração mecânica, não leitura a olho. Um requisito citado em prosa no `design.md` mas
ausente de `tasks.md` é exatamente o caso que uma conferência manual perde, porque a memória
de quem escreveu preenche a lacuna.

- **Critérios definidos**: cada item numerado sob `**Critérios de aceite:**` em cada seção
  `## REQ-## — …` de `requirements.md`.
- **Critérios referenciados**: cada `REQ-##.#` nas linhas `- Requisitos:` de `tasks.md`,
  associado ao marcador da task a que pertence.
- **Isenções**: TASK-073 a TASK-077 têm origem "Entrega / fechamento" e não mapeiam para
  `REQ` — a categoria de origem *é* a rastreabilidade delas. Cobrar `REQ` dessas quatro faria
  a auditoria acusar a si mesma.

## Resultado

| Medida | Valor |
|---|---|
| `REQ` de topo | 23 (REQ-00 a REQ-22) |
| Critérios de aceite numerados | 129 |
| Critérios referenciados por task concluída `[x]` | 119 |
| Critérios órfãos (nenhuma task os cita) | **10** |
| Referências para `REQ` inexistente (*dangling*) | 0 |
| Critérios cobertos **apenas** por task não concluída | 0 |

`REQ-00.1` e `REQ-00.2` não existem: viraram REQ-21 (verificação de saúde), com a numeração
dos demais preservada porque já havia tasks apontando para `REQ-00.3`/`REQ-00.4`. A lacuna é
declarada em `requirements.md` e não é órfã.

Tasks ativas: **75** — 72 `[x]`, 3 `[ ]` (TASK-074 a TASK-076, as de fechamento). Quatro `[>]`
realocadas, nenhuma `[~]`.

---

## Os 10 órfãos, um a um

Nenhum é lacuna de comportamento. **Todos os dez têm cobertura;** o que faltava era o
mapeamento. Por isso nenhum recebeu "decidimos não implementar" — escrever isso sobre
comportamento que existe e é testado seria pior que o silêncio original.

| Critério | O que exige | Onde está coberto |
|---|---|---|
| **REQ-04.2** | desvinculação preserva os envios já realizados | `softdelete.sweep.integration.spec.ts` → item 4 (duas versões intactas após remoção do vínculo); `submissions.integration.spec.ts` → "histórico segue acessível após remoção do vínculo" |
| **REQ-04.4** | permitir desvincular vínculo que já possui envio ativo | `employee-documents.integration.spec.ts` → "vínculo novo reinicia a numeração de versões", que desvincula depois de dois envios e segue adiante |
| **REQ-04.6** | vínculo desvinculado sai de pendências e estatísticas | `pending.coherence.integration.spec.ts` → "listagem acompanha cada transição de estado" (passo de desvinculação); `softdelete.sweep.integration.spec.ts` → itens 3 e 7 |
| **REQ-08.5** | pendente **com** histórico é estado válido e exibido normalmente | `submissions.integration.spec.ts` → "mantém o vínculo pendente enquanto não há novo envio" e "continua a contagem de versões após a remoção do envio ativo". A TASK-047 registra ter levado junto exatamente este estado, que D-13 declara válido |
| **REQ-11.8** | o total paginado conta só quem satisfaz REQ-14 | `employees.repository.integration.spec.ts` e `document-types.repository.integration.spec.ts` → "exclui removido da listagem **e do total**"; `softdelete.sweep.integration.spec.ts` → itens 1, 2 e 3 afirmam `total`. Decisão em `design.md` §860 |
| **REQ-13.7** | rejeita vinculação a tipo removido | Mesmo comportamento de REQ-03.3, que tem TASK-028 `[x]`. Provado em `employee-documents.service.spec.ts` e em `softdelete.sweep.integration.spec.ts` → item 11 |
| **REQ-15.5** | falha de operação crítica informa o motivo sem vazar detalhe interno | `exception.filter.spec.ts` → "responde 500 genérico sem expor stack", que afirma a ausência de constraint, tabela, SQL, código do driver e quadro de pilha no corpo. O teste rotula REQ-19.4; é o mesmo comportamento |
| **REQ-15.6** | classificar cadastros como não críticos **e justificar na documentação de entrega** | Classificação em `design.md` D-04, com o critério que a produziu. **A metade "documentação de entrega" depende do README (TASK-075)** — ver ressalva abaixo |
| **REQ-16.7** | calcular as medidas por agregação no banco | `statistics.repository.ts` — os três métodos são SQL puro via `executor.query`, sem coleção carregada. TASK-070 validou o plano com `EXPLAIN` |
| **REQ-17.5** | idem, para o ranking de tipos pendentes | `rankingDeTiposPendentes`, mesma construção. Coberto por `statistics.repository.integration.spec.ts` → "ordena tipos por pendencia com desempate estavel" e "inclui tipo ativo sem nenhuma pendencia" |

### A única ressalva: REQ-15.6

É o único dos dez que **não** está inteiramente satisfeito hoje. Exige duas coisas, e só uma
existe: a classificação está em `design.md` D-04; a justificativa "na documentação de entrega"
depende do README, que é a TASK-075 e não foi escrito. Não é órfão de implementação — é
critério cuja segunda metade vence junto com o README.

Registrado aqui para que a TASK-075 não o esqueça: **o README precisa justificar por que
cadastro de colaborador, cadastro de tipo, remoção de envio ativo e desvinculação não são
operações críticas.** O enunciado cobra a discriminação, não a lista.

---

## Referências de granularidade de topo

Seis referências apontam para o `REQ` inteiro em vez de um critério: `REQ-00` (TASK-001,
TASK-002, TASK-078) e `REQ-06`/`REQ-07`/`REQ-09`/`REQ-10`/`REQ-16` (TASK-069, a suíte E2E).

Passam pela auditoria sem provar critério nenhum. Nos dois casos é defensável — fundação e
teste de fluxo completo atravessam o requisito inteiro por natureza —, mas fica registrado
que a granularidade é mais grossa ali do que no resto do arquivo, e que uma auditoria futura
não deve ler essas seis como cobertura de critério.

---

## Achados colaterais, corrigidos nesta task

Encontrados durante a auditoria. **Não são requisito sem task** — são desalinhamento entre
documentos, que é uma categoria diferente e por isso está em seção separada.

1. **`requirements.md` REQ-15 divergia de `design.md` D-04 sobre quantas operações são
   críticas.** D-04 revisou a classificação de seis para quatro, reclassificando remoção de
   envio ativo e desvinculação como escrita de linha única; `requirements.md` seguiu listando
   seis em REQ-15.1 e isentando apenas duas em REQ-15.6. Corrigido o requisito para bater com
   a decisão. É a resposta ao item do enunciado que pede exatamente essa discriminação —
   duas fontes discordando não é detalhe de redação.
2. **`design.md` §420 dizia "as seis operações de D-04"**, resíduo da mesma revisão, três
   parágrafos abaixo da tabela que lista quatro. Corrigido.
3. **Cabeçalho de `tasks.md` desatualizado**: "74 tasks ativas · P0 35 · P1 31" quando o real
   é 75 · P1 32, depois da entrada da TASK-079. Os denominadores derivados no mesmo bloco
   ("13 de 74", "as 61 restantes") herdavam o número velho. Corrigidos.
4. **As quatro tasks de fechamento declaravam `Requisitos:` apesar de isentas.** TASK-073
   citava REQ-14; TASK-074 a TASK-076, REQ-00 — enquanto o bloco logo acima as declarava
   isentas de mapeamento. Rodando a regra desta própria auditoria, apareceriam ora como
   cobertas, ora como isentas. Todas passaram a `Origem: Entrega / fechamento`, padrão que a
   TASK-077 já usava.

O item 1 e o item 4 são do mesmo tipo: documento que contradiz outro documento sobre uma
decisão que já foi tomada. Nenhum dos dois quebra o sistema, e os dois quebrariam a leitura
de quem chega depois — que é o que estes arquivos existem para servir.

### Quinto achado, corrigido em commit próprio

**O `commitlint` recusava o commit desta auditoria.** `scope-empty: [2, 'never']` exigia
escopo em todo tipo, mas `convencoes.md` documenta `docs:` sem escopo na sequência de
referência, `tasks.md` declara `Commit: docs` para as TASK-074 e TASK-075, e `b69723f` já
existia no histórico nessa forma. A config divergia da convenção que dizia aplicar.

Corrigido em **`97f897b`** (`fix(infra)`), separado deste commit por ser mudança de
configuração e não de documentação — mesma classe do `756c13f`, que corrigiu `subject-case`
pelo mesmo motivo. A regra passou a testar o tipo: a exceção abre só para `docs`, e os demais
continuam exigindo escopo. `convencoes.md` passou a declarar a exceção explicitamente, em vez
de deixá-la implícita na sequência de referência — que foi o que permitiu a divergência passar.

Fica registrado aqui para não parecer configuração afrouxada por conveniência: a regra ficou
mais precisa, não mais permissiva.

---

## Validação em clone limpo

Preenchido pela TASK-076.
