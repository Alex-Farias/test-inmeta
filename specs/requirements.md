# Requisitos

O **que** o sistema faz. Critérios de aceite em notação EARS, conforme
`.claude/skills/spec-flow/references/spec-standard.md`.

Este documento não menciona classe, tabela, biblioteca ou rota — isso é `specs/design.md`.
Escolhas de tecnologia estão em `stack.md`.

Numeração **estável**: um `REQ-##` nunca é renumerado depois que existir task apontando
para ele. Requisito descartado vira nota, não buraco.

---

## Vocabulário

Termos usados com sentido preciso em todo o documento.

| Termo | Significado |
|---|---|
| **Colaborador** | Pessoa cuja documentação é acompanhada |
| **Tipo de documento** | Item do catálogo de documentos que podem ser exigidos (CPF, ASO, Certidão) |
| **Vínculo** | A obrigação: "este colaborador deve entregar este tipo de documento" |
| **Envio** | O ato de entregar um documento para um vínculo. Representação lógica, sem arquivo |
| **Versão** | Número sequencial do envio dentro de um vínculo, começando em 1 |
| **Envio ativo** | O envio vigente de um vínculo. No máximo um por vínculo |
| **Pendente** | Vínculo ativo **sem** envio ativo |
| **Entregue** | Vínculo ativo **com** envio ativo |
| **Remoção** | Sempre lógica. Nada é removido fisicamente em nenhuma hipótese |
| **Ativo** | Registro ainda não removido logicamente |

---

## Índice

| REQ | Título | Origem |
|---|---|---|
| REQ-00 | Preparo do serviço | Fundação |
| REQ-01 | Cadastro de colaboradores | Enunciado |
| REQ-02 | Cadastro de tipos de documento | Enunciado |
| REQ-03 | Vinculação de colaborador a tipos de documento | Enunciado |
| REQ-04 | Desvinculação | Enunciado |
| REQ-05 | Re-vínculo após desvinculação | Decisão D-07 |
| REQ-06 | Envio de documento | Enunciado |
| REQ-07 | Reenvio com versionamento e histórico | Enunciado (avaliado) |
| REQ-08 | Remoção de envio | Enunciado (avaliado) |
| REQ-09 | Consulta do histórico de versões | Enunciado (avaliado) |
| REQ-10 | Listagem de documentos pendentes com filtros | Enunciado |
| REQ-11 | Paginação | Enunciado (transversal) |
| REQ-12 | Remoção de colaborador | Enunciado (avaliado) |
| REQ-13 | Remoção de tipo de documento | Escolha nossa |
| REQ-14 | Soft delete refletido em todas as consultas | Enunciado (avaliado, transversal) |
| REQ-15 | Atomicidade das operações críticas | Enunciado (avaliado, transversal) |
| REQ-16 | Estatística: conformidade global | Enunciado |
| REQ-17 | Estatística: tipos mais pendentes | Enunciado |
| REQ-18 | Estatística: últimos envios | Enunciado |
| REQ-19 | Tratamento de erros | Enunciado (avaliado) |
| REQ-20 | Observabilidade | Diferencial |
| REQ-21 | Verificação de saúde do serviço | Diferencial |
| REQ-22 | Documentação da API | Diferencial |

### Vocabulário de origem

Os dois qualificadores são independentes e um requisito pode ter os dois:

| Qualificador | Significado |
|---|---|
| **Avaliado** | O enunciado o nomeia como critério de avaliação |
| **Transversal** | Atravessa os outros requisitos, e por isso precisa de `REQ` próprio |

REQ-14 e REQ-15 são os dois: são critério de avaliação declarado **e** atravessam todo o
sistema. REQ-11 é apenas Transversal — paginação aparece em toda listagem, mas o enunciado a
lista no escopo funcional, não entre os critérios de avaliação.

A origem determina o nível da task que atende o requisito. O mapeamento está em
`specs/tasks.md`.

---

## Restrições de entrega

**Isto não é um `REQ`, e a distinção é deliberada.** Este documento descreve comportamento do
sistema, em EARS. As exigências abaixo são propriedades da **entrega**, não do sistema: quem
mantém o histórico de commits é o desenvolvedor, não a aplicação. "O sistema DEVE manter
histórico incremental" não se escreve com honestidade — e um requisito que não cabe em EARS é
sinal de que não é requisito.

Ficam registradas aqui para estarem visíveis, sem fingir rastreabilidade que não têm:

| Restrição | Origem |
|---|---|
| O projeto deve estar no GitHub | Enunciado, "Restrições" |
| Não deve ser feito fork de nenhum outro projeto | Enunciado, "Restrições" |
| Apenas o meu usuário deve realizar commits | Enunciado, "Restrições" |
| Histórico de commits incremental, sem um único commit gigante | Enunciado, "Restrições" e critério de avaliação "Commits" |

São atendidas por tasks de origem **"Entrega / fechamento"** em `specs/tasks.md`, que a
auditoria de rastreabilidade isenta de mapeamento para `REQ` — a categoria de origem é a
rastreabilidade delas.

---

## REQ-00 — Preparo do serviço

**História:** Como avaliador que acabou de clonar o repositório, quero subir o sistema
seguindo o README, para verificar que ele funciona fora da máquina de quem o escreveu.

**Critérios de aceite:**

Os critérios 1 e 2 desta numeração foram movidos para REQ-21, por serem diferencial e não
fundação. A numeração dos que restam é preservada, porque já existem tasks apontando para
`REQ-00.3` e `REQ-00.4`.

3. QUANDO o sistema é iniciado com configuração obrigatória ausente ou inválida, o sistema
   DEVE falhar imediatamente na inicialização, com mensagem que identifique o item faltante.
4. O sistema DEVE aplicar alterações de estrutura do banco apenas por passo explícito de
   migração, nunca por sincronização automática, inclusive em ambiente de desenvolvimento.

---

## REQ-01 — Cadastro de colaboradores

**História:** Como gestor de RH, quero cadastrar e consultar colaboradores, para acompanhar
a documentação de cada um.

**Critérios de aceite:**

1. QUANDO um colaborador é cadastrado com dados válidos, o sistema DEVE registrá-lo e
   devolver sua identificação.
2. O sistema DEVE exigir nome e endereço de e-mail para cadastrar um colaborador.
3. SE o endereço de e-mail informado já pertencer a um colaborador ativo, ENTÃO o sistema
   DEVE rejeitar o cadastro com erro de conflito.
4. QUANDO um colaborador é consultado por identificação inexistente ou removida, o sistema
   DEVE responder que o recurso não foi encontrado.
5. QUANDO os dados de um colaborador ativo são atualizados com valores válidos, o sistema
   DEVE persistir a alteração.
6. O sistema DEVE permitir listar colaboradores ativos.

---

## REQ-02 — Cadastro de tipos de documento

**História:** Como gestor de RH, quero manter o catálogo de tipos de documento, para definir
o que pode ser exigido de um colaborador.

**Critérios de aceite:**

1. QUANDO um tipo de documento é cadastrado com dados válidos, o sistema DEVE registrá-lo e
   devolver sua identificação.
2. O sistema DEVE exigir um nome para cadastrar um tipo de documento.
3. SE o nome informado já pertencer a um tipo de documento ativo, ENTÃO o sistema DEVE
   rejeitar o cadastro com erro de conflito.
4. O sistema DEVE permitir listar tipos de documento ativos.
5. QUANDO um tipo de documento é consultado por identificação inexistente ou removida, o
   sistema DEVE responder que o recurso não foi encontrado.

---

## REQ-03 — Vinculação de colaborador a tipos de documento

**História:** Como gestor de RH, quero vincular vários tipos de documento a um colaborador
de uma vez, para definir o conjunto que ele precisa entregar.

**Critérios de aceite:**

1. QUANDO um colaborador ativo é vinculado a um ou mais tipos de documento ativos, o sistema
   DEVE criar um vínculo por tipo informado, todos no estado pendente.
2. QUANDO uma vinculação em lote é solicitada, o sistema DEVE criar todos os vínculos
   solicitados ou nenhum deles.
3. SE qualquer tipo de documento informado no lote estiver removido ou não existir, ENTÃO o
   sistema DEVE rejeitar a operação inteira e não criar nenhum vínculo.
4. SE o colaborador informado estiver removido ou não existir, ENTÃO o sistema DEVE rejeitar
   a operação e não criar nenhum vínculo.
5. SE algum dos tipos informados já possuir vínculo ativo com esse colaborador, ENTÃO o
   sistema DEVE rejeitar a operação inteira com erro de conflito.
6. EM QUALQUER MOMENTO, um colaborador DEVE possuir no máximo um vínculo ativo por tipo de
   documento.

---

## REQ-04 — Desvinculação

**História:** Como gestor de RH, quero desvincular um tipo de documento de um colaborador,
para deixar de cobrar um documento que não é mais exigido dele.

**Critérios de aceite:**

1. QUANDO um vínculo ativo é desvinculado, o sistema DEVE marcá-lo como removido.
2. QUANDO um vínculo é desvinculado, o sistema DEVE preservar todos os envios já realizados
   nesse vínculo.
3. QUANDO um vínculo é desvinculado, o sistema DEVE registrar que a remoção teve causa
   manual, distinguindo-a de remoções decorrentes da remoção do tipo de documento.
4. O sistema DEVE permitir desvincular um vínculo mesmo que ele já possua envio ativo.
5. SE a desvinculação for solicitada para um vínculo já removido ou inexistente, ENTÃO o
   sistema DEVE responder que o recurso não foi encontrado.
6. QUANDO um vínculo é desvinculado, o sistema DEVE deixar de considerá-lo em pendências e
   em todas as estatísticas.

---

## REQ-05 — Re-vínculo após desvinculação

**História:** Como gestor de RH, quero voltar a exigir um documento que havia deixado de
ser exigido, para retomar a cobrança sem ambiguidade sobre o que ocorreu no intervalo.

**Critérios de aceite:**

1. QUANDO um colaborador é vinculado a um tipo de documento com o qual já teve vínculo
   removido, o sistema DEVE criar um vínculo novo e distinto do anterior.
2. QUANDO um vínculo novo é criado nessa situação, o sistema DEVE iniciar sua contagem de
   versões em 1, independentemente das versões do vínculo anterior.
3. O sistema DEVE manter os envios do vínculo anterior permanentemente consultáveis como
   histórico.
4. O sistema NÃO DEVE considerar o vínculo anterior nem seus envios em pendências ou em
   estatísticas.

---

## REQ-06 — Envio de documento

**História:** Como gestor de RH, quero registrar a entrega de um documento exigido, para que
ele deixe de constar como pendente.

**Critérios de aceite:**

1. QUANDO um documento é enviado para um vínculo ativo sem envio anterior, o sistema DEVE
   registrar o envio como versão 1 e marcá-lo como ativo.
2. QUANDO um envio é registrado, o sistema DEVE passar o vínculo ao estado entregue.
3. QUANDO um envio é registrado, o sistema DEVE registrar o instante em que ele ocorreu.
4. SE o envio for solicitado para um vínculo removido ou inexistente, ENTÃO o sistema DEVE
   responder que o recurso não foi encontrado, e não com erro interno.
5. SE o envio for solicitado para um vínculo cujo colaborador está removido, ENTÃO o sistema
   DEVE rejeitar a operação.

---

## REQ-07 — Reenvio com versionamento e histórico

**História:** Como gestor de RH, quero reenviar um documento já entregue, para corrigir um
envio anterior sem perder o registro do que foi enviado antes.

**Critérios de aceite:**

1. QUANDO um documento é reenviado para um vínculo que já possui envio ativo, o sistema DEVE
   desativar o envio anterior e registrar o novo com a versão incrementada em 1.
2. O sistema DEVE manter permanentemente acessíveis todas as versões anteriores de um envio.
3. EM QUALQUER MOMENTO, um vínculo DEVE possuir no máximo um envio ativo.
4. O sistema DEVE manter a sequência de versões de um vínculo contígua e sem repetição.
5. SE dois reenvios do mesmo vínculo forem processados concorrentemente, ENTÃO o sistema DEVE
   persistir exatamente um deles e rejeitar o outro com erro de conflito.
6. SE um reenvio for rejeitado por conflito, ENTÃO o sistema DEVE deixar o vínculo no estado
   em que estava antes da tentativa, sem versão órfã e sem envio ativo duplicado.

---

## REQ-08 — Remoção de envio

**História:** Como gestor de RH, quero remover um envio registrado por engano, para que o
documento volte a constar como pendente sem que o histórico seja falsificado.

O enunciado determina que "colaboradores e documentos não podem ser removidos fisicamente".
"Documentos" admite duas leituras — o vínculo ou o envio. Este requisito atende as duas.

**Critérios de aceite:**

1. QUANDO o envio ativo de um vínculo é removido, o sistema DEVE marcá-lo como removido e
   passar o vínculo ao estado pendente.
2. QUANDO o envio ativo é removido, o sistema NÃO DEVE reativar nenhuma versão anterior.
3. QUANDO o envio ativo é removido, o sistema DEVE manter as versões anteriores acessíveis
   como histórico, todas inativas.
4. QUANDO um novo envio ocorre após a remoção do envio ativo, o sistema DEVE continuar a
   contagem de versões a partir da maior versão já usada no vínculo, sem reiniciá-la e sem
   reaproveitar número já emitido.
5. O sistema DEVE tratar como válido e esperado o estado de vínculo pendente que possui
   histórico de envios, exibindo-o normalmente em pendências e estatísticas.
6. SE a remoção for solicitada para um envio já removido ou inexistente, ENTÃO o sistema DEVE
   responder que o recurso não foi encontrado.

---

## REQ-09 — Consulta do histórico de versões

**História:** Como gestor de RH, quero consultar todas as versões enviadas de um documento,
para auditar o que foi entregue e quando.

**Critérios de aceite:**

1. O sistema DEVE permitir consultar todos os envios de um vínculo, ativos e inativos.
2. QUANDO o histórico de um vínculo é consultado, o sistema DEVE indicar, para cada envio,
   sua versão, o instante do envio e se ele é o envio ativo.
3. QUANDO o histórico é consultado, o sistema DEVE apresentar os envios em ordem
   determinística de versão.
4. O sistema DEVE manter o histórico consultável mesmo após o vínculo ter sido removido.
5. O sistema DEVE manter o histórico consultável mesmo após o colaborador ter sido removido.

---

## REQ-10 — Listagem de documentos pendentes com filtros

**História:** Como gestor de RH, quero listar os documentos pendentes, para saber o que
ainda precisa ser cobrado e de quem.

**Critérios de aceite:**

1. O sistema DEVE permitir listar os vínculos ativos que estão pendentes.
2. O sistema DEVE permitir filtrar a listagem de pendentes por colaborador.
3. O sistema DEVE permitir filtrar a listagem de pendentes por tipo de documento.
4. ONDE mais de um filtro for informado, o sistema DEVE aplicá-los de forma cumulativa.
5. QUANDO a listagem de pendentes é consultada, o sistema DEVE identificar, para cada item,
   o colaborador e o tipo de documento correspondentes.
6. O sistema NÃO DEVE incluir na listagem vínculos que possuam envio ativo.
7. SE um filtro referenciar colaborador ou tipo de documento inexistente ou removido, ENTÃO
   o sistema DEVE retornar resultado vazio, e não erro.

---

## REQ-11 — Paginação

**História:** Como consumidor da API, quero percorrer listagens grandes em partes, para não
depender de uma resposta que cresce sem limite.

**Critérios de aceite:**

1. O sistema DEVE paginar todas as listagens de coleção.
2. O sistema DEVE aceitar, em toda listagem paginada, a indicação de qual página se deseja e
   de quantos itens ela contém.
3. QUANDO parâmetros de paginação não são informados, o sistema DEVE aplicar valores padrão
   documentados.
4. O sistema DEVE limitar a quantidade máxima de itens por página, ainda que seja solicitada
   quantidade maior.
5. QUANDO uma listagem paginada é retornada, o sistema DEVE informar o total de itens que
   satisfazem a consulta, além dos itens da página corrente.
6. SE parâmetros de paginação inválidos forem informados, ENTÃO o sistema DEVE rejeitar a
   requisição com erro de validação.
7. O sistema DEVE aplicar ordenação determinística em toda listagem paginada, de modo que um
   mesmo item não apareça em duas páginas nem seja omitido de todas.
8. O sistema DEVE contar, no total informado, apenas registros que satisfaçam também as
   regras de remoção lógica descritas em REQ-14.

---

## REQ-12 — Remoção de colaborador

**História:** Como gestor de RH, quero remover um colaborador desligado, para que ele deixe
de ser cobrado sem que o registro do que ele entregou seja perdido.

**Critérios de aceite:**

1. QUANDO um colaborador é removido, o sistema DEVE marcá-lo como removido sem apagá-lo
   fisicamente.
2. QUANDO um colaborador é removido, o sistema DEVE marcar como removidos todos os seus
   vínculos ativos.
3. QUANDO um colaborador é removido, o sistema DEVE preservar todos os envios associados aos
   seus vínculos.
4. QUANDO um colaborador é removido, o sistema DEVE marcá-lo e propagar a remoção aos seus
   vínculos de forma atômica, conforme REQ-15.
5. QUANDO um colaborador é removido, o sistema DEVE liberar seu endereço de e-mail para uso
   por um novo cadastro.
6. SE a remoção for solicitada para um colaborador já removido ou inexistente, ENTÃO o
   sistema DEVE responder que o recurso não foi encontrado.

---

## REQ-13 — Remoção de tipo de documento

**História:** Como gestor de RH, quero remover do catálogo um tipo de documento que deixou
de ser exigido, para que ele pare de gerar pendência para todos os colaboradores.

O enunciado exige remoção lógica apenas para colaboradores e documentos. A semântica de
remoção de tipo de documento é **escolha deste projeto**, e está registrada como tal.

**Critérios de aceite:**

1. QUANDO um tipo de documento é removido, o sistema DEVE marcá-lo como removido sem
   apagá-lo fisicamente.
2. QUANDO um tipo de documento é removido, o sistema DEVE marcar como removidos todos os
   vínculos ativos que o exigem.
3. QUANDO um vínculo é removido por decorrência da remoção do seu tipo de documento, o
   sistema DEVE registrar essa causa de remoção, distinguindo-a da desvinculação manual
   descrita em REQ-04.
4. QUANDO um tipo de documento é removido, o sistema DEVE marcá-lo e propagar a remoção aos
   vínculos afetados de forma atômica, conforme REQ-15.
5. QUANDO um tipo de documento é removido, o sistema DEVE preservar todos os envios
   associados aos vínculos afetados.
6. QUANDO um tipo de documento é removido, o sistema DEVE liberar seu nome para uso por um
   novo cadastro.
7. SE for solicitada a vinculação de um colaborador a um tipo de documento removido, ENTÃO o
   sistema DEVE rejeitar a operação, conforme REQ-03.3.

---

## REQ-14 — Soft delete refletido em todas as consultas

**História:** Como gestor de RH, quero que uma remoção se reflita em tudo que o sistema
mostra, para não tomar decisão com base em número que conta registro removido.

Este requisito atravessa todos os demais. Ele existe separado porque é critério de avaliação
declarado e porque é a falha mais silenciosa possível: uma consulta esquecida não quebra
nada, apenas responde errado.

**Critérios de aceite:**

1. O sistema NÃO DEVE remover fisicamente colaborador, tipo de documento, vínculo ou envio,
   em nenhuma operação.
2. O sistema DEVE excluir registros removidos de toda listagem, contagem, filtro e
   estatística, exceto onde o histórico for explicitamente solicitado.
3. O sistema DEVE excluir de pendências e estatísticas todo vínculo cujo colaborador esteja
   removido, ainda que o próprio vínculo não esteja marcado como removido.
4. O sistema DEVE excluir de pendências e estatísticas todo vínculo cujo tipo de documento
   esteja removido, ainda que o próprio vínculo não esteja marcado como removido.
5. O sistema DEVE excluir de toda estatística os envios pertencentes a vínculos removidos.
6. O sistema DEVE manter o histórico de envios acessível por consulta explícita mesmo quando
   o vínculo, o colaborador ou o tipo de documento correspondentes estiverem removidos,
   conforme REQ-09.
7. O sistema DEVE aplicar unicidade de e-mail de colaborador e de nome de tipo de documento
   apenas entre registros ativos.
8. SE uma operação de escrita for solicitada sobre um registro removido, ENTÃO o sistema DEVE
   responder que o recurso não foi encontrado, e não com erro interno.

---

## REQ-15 — Atomicidade das operações críticas

**História:** Como gestor de RH, quero que uma operação que altera vários registros nunca
seja aplicada pela metade, para que o sistema não fique num estado que ninguém pediu.

Identificar quais operações são críticas faz parte do desafio. As quatro abaixo são críticas
porque cada uma envolve mais de uma escrita relacionada, com invariante entre elas.

**Critérios de aceite:**

1. O sistema DEVE aplicar integralmente, ou não aplicar de forma alguma, cada uma das
   operações a seguir:
   - vinculação em lote (REQ-03)
   - envio e reenvio de documento (REQ-06, REQ-07)
   - remoção de colaborador com propagação aos vínculos (REQ-12)
   - remoção de tipo de documento com propagação aos vínculos (REQ-13)
2. SE qualquer escrita de uma operação crítica falhar, ENTÃO o sistema DEVE desfazer todas as
   escritas já realizadas nessa operação.
3. QUANDO uma operação crítica falha, o sistema DEVE deixar os dados exatamente no estado
   anterior à operação.
4. O sistema DEVE manter, ao final de toda operação crítica, a coerência entre o estado
   declarado de um vínculo e a existência de envio ativo nele.
5. QUANDO uma operação crítica falha, o sistema DEVE informar o motivo da falha, sem expor
   detalhe interno de implementação.
6. O sistema DEVE tratar como **não críticas** as operações de escrita única sem invariante
   entre registros — o cadastro de colaborador (REQ-01), o cadastro de tipo de documento
   (REQ-02), a remoção de envio ativo (REQ-08) e a desvinculação (REQ-04) —, e essa
   classificação DEVE ser justificada na documentação de entrega. A classificação revisada e
   o critério que a produziu estão em `design.md`, D-04.

---

## REQ-16 — Estatística: conformidade global

**História:** Como gestor de RH, quero saber o quanto da documentação exigida já foi
entregue, para dimensionar o esforço de cobrança que ainda falta.

"Percentual de documentação completa" admite duas leituras válidas e numericamente
diferentes. O sistema expõe as duas, nomeadas sem ambiguidade, em vez de escolher uma em
silêncio.

**Critérios de aceite:**

1. O sistema DEVE informar o percentual de colaboradores ativos que entregaram todos os
   documentos exigidos deles.
2. O sistema DEVE informar o percentual de documentos entregues sobre o total de documentos
   exigidos.
3. O sistema DEVE nomear as duas medidas de forma que não possam ser confundidas entre si.
4. O sistema DEVE excluir do cálculo descrito no critério 1 os colaboradores ativos que não
   possuam nenhum vínculo ativo, informando separadamente quantos foram excluídos.
5. O sistema DEVE considerar, em ambas as medidas, apenas colaboradores, tipos de documento e
   vínculos ativos, conforme REQ-14.
6. SE não houver nenhum registro que sirva de base para uma medida, ENTÃO o sistema DEVE
   retornar um valor definido para ela, e não erro.
7. O sistema DEVE calcular as medidas por agregação no banco de dados, sem carregar coleções
   para reduzir em memória.

---

## REQ-17 — Estatística: tipos mais pendentes

**História:** Como gestor de RH, quero saber quais tipos de documento mais faltam, para
priorizar a cobrança pelo que trava mais gente.

**Critérios de aceite:**

1. O sistema DEVE informar, para cada tipo de documento ativo, a quantidade de vínculos
   ativos pendentes que o exigem.
2. O sistema DEVE ordenar o resultado da maior para a menor quantidade de pendências.
3. O sistema DEVE desempatar o resultado por critério determinístico, de modo que duas
   consultas idênticas sobre os mesmos dados retornem a mesma ordem.
4. O sistema DEVE excluir do resultado tipos de documento removidos, vínculos removidos e
   vínculos de colaboradores removidos.
5. O sistema DEVE calcular o resultado por agregação no banco de dados.

---

## REQ-18 — Estatística: últimos envios

**História:** Como gestor de RH, quero ver os envios mais recentes, para acompanhar o que
está chegando sem precisar consultar colaborador por colaborador.

**Critérios de aceite:**

1. O sistema DEVE informar os envios mais recentes, do mais novo para o mais antigo.
2. QUANDO os últimos envios são consultados, o sistema DEVE identificar, para cada envio, o
   colaborador, o tipo de documento, a versão e o instante do envio.
3. O sistema DEVE limitar a quantidade de envios retornados, com valor padrão documentado e
   teto máximo.
4. O sistema DEVE excluir do resultado envios pertencentes a vínculos removidos, a
   colaboradores removidos ou a tipos de documento removidos.
5. O sistema DEVE incluir no resultado envios que não sejam mais a versão ativa do seu
   vínculo, por representarem entregas efetivamente ocorridas.
6. O sistema DEVE desempatar por critério determinístico envios ocorridos no mesmo instante.

---

## REQ-19 — Tratamento de erros

**História:** Como consumidor da API, quero que o erro me diga o que aconteceu e o que fazer,
para não precisar ler o código do servidor nem adivinhar pelo código de status.

**Critérios de aceite:**

1. O sistema DEVE responder a toda falha com um formato de erro único e estável, qualquer que
   seja a origem da falha.
2. O sistema DEVE distinguir, por código próprio na resposta, recurso não encontrado, dado
   inválido, regra de negócio violada e conflito de estado.
3. O sistema DEVE incluir em toda resposta de erro um identificador da requisição que
   permita localizá-la nos registros de execução.
4. O sistema NÃO DEVE expor, em resposta de erro, rastreamento de pilha, consulta ao banco,
   nome de tabela ou qualquer detalhe interno de implementação.
5. SE ocorrer falha não prevista, ENTÃO o sistema DEVE responder com erro genérico de
   servidor e registrar internamente o rastreamento completo associado ao identificador da
   requisição.
6. QUANDO a validação de entrada falha, o sistema DEVE indicar quais campos foram recusados.
7. O sistema DEVE rejeitar campos não reconhecidos na entrada, em vez de ignorá-los em
   silêncio.

---

## REQ-20 — Observabilidade

**História:** Como responsável pela operação, quero acompanhar o que o sistema está fazendo,
para diagnosticar um problema sem reproduzi-lo localmente.

**Critérios de aceite:**

1. O sistema DEVE emitir registros de execução em formato estruturado, legível por máquina.
2. O sistema DEVE associar a um mesmo identificador de requisição todos os registros
   emitidos durante o processamento dela.
3. O sistema DEVE usar, nesses registros, o mesmo identificador de requisição devolvido nas
   respostas de erro descritas em REQ-19.3.
4. O sistema NÃO DEVE registrar dados pessoais de colaboradores em texto aberto nos registros
   de execução.
5. ONDE o ambiente não for de produção, o sistema DEVE poder emitir os registros em formato
   legível por humano.

---

## REQ-21 — Verificação de saúde do serviço

**História:** Como responsável pela operação, quero consultar se o serviço está saudável,
para saber se ele consegue atender antes de o usuário descobrir que não.

Critérios originalmente numerados como REQ-00.1 e REQ-00.2, separados por serem diferencial
declarado do enunciado, não preparo de infraestrutura.

**Critérios de aceite:**

1. O sistema DEVE expor uma verificação de saúde que reporte o estado da sua conexão com o
   banco de dados.
2. SE o banco de dados estiver indisponível, ENTÃO a verificação de saúde DEVE reportar
   estado não saudável, e não sucesso.

---

## REQ-22 — Documentação da API

**História:** Como avaliador, quero exercitar a API sem ler o código antes, para verificar o
comportamento pelo contrato publicado.

**Critérios de aceite:**

1. O sistema DEVE publicar a documentação de suas rotas em formato navegável.
2. O sistema DEVE documentar, para cada rota, o formato de requisição e de resposta.
3. O sistema DEVE documentar o catálogo de códigos de erro descrito em REQ-19.2.
4. A documentação DEVE ser derivada da mesma definição que valida a entrada, de modo que não
   exista segunda fonte de verdade a manter.

---

## Fora de escopo

Registrado explicitamente para que a ausência seja lida como decisão, não como esquecimento.

| Item | Motivo |
|---|---|
| Autenticação e autorização | O enunciado declara que não será avaliado e não deve consumir foco |
| Upload e armazenamento de arquivo | O enunciado pede representação lógica do envio |
| Restauração de registros removidos | Não pedido. REQ-04.3 e REQ-13.3 registram a causa da remoção justamente para que a restauração seletiva permaneça possível depois, sem migração de dados |
| Notificação de pendência | Não pedido |
| Cache de estatísticas | REQ-16.7 exige agregação em banco. Em volume maior a evolução natural é materializar a consulta — registrar na entrega, não implementar |
| Histórico de alteração de cadastro | O enunciado exige histórico de envios, não auditoria de campos |
