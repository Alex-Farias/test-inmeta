# Convenções

Processo: commits, autorrevisão e fechamento. **Estratégia de testes e estrutura de pastas
não estão mais aqui** — foram absorvidas por `specs/design.md`, §5 e §2.

## Commits

Conventional Commits, escopo = módulo.

```
<tipo>(<escopo>): <descrição no imperativo, minúscula, sem ponto final>

<corpo opcional: o porquê, não o quê>
```

**Tipos:** `feat` · `fix` · `refactor` · `test` · `chore` · `docs` · `perf`

**Escopos:** `employees` · `document-types` · `employee-documents` · `submissions` ·
`statistics` · `shared` · `db` · `infra`

`docs` é o **único tipo que dispensa escopo**, reservado a entregáveis que atravessam o
projeto inteiro — README, auditorias de rastreabilidade — e não uma task específica de um
módulo. Todos os demais exigem escopo. A regra está no `commitlint.config.js`, que testa o
tipo em vez de aplicar `scope-empty` global.

### Regras

- **Uma task = um commit.** Se o diff em stage contém mais de uma unidade lógica, pare e
  proponha a divisão antes de commitar.
- **O commit compila e os testes passam.** Sem `wip`, sem "corrige commit anterior".
- **Teste junto da feature**, no mesmo commit ou no imediatamente seguinte com escopo
  idêntico. Nunca um commit "adiciona testes" no fim do projeto.
- **Corpo explicando o porquê** nos commits de decisão arquitetural — são os que o
  avaliador vai abrir.
- Nunca `--amend`, `push --force` ou rebase em commits já enviados. O histórico é entregável.

### Sequência de referência

```
chore(infra): inicializa projeto nest com typescript e eslint
chore(infra): adiciona docker-compose com postgres 16
chore(db): configura typeorm com data source e migrations
feat(shared): adiciona hierarquia de erros de dominio
feat(shared): adiciona exception filter global com request id
feat(shared): adiciona transaction runner sobre o data source
feat(db): cria migration inicial das quatro tabelas do dominio
feat(employees): adiciona cadastro e listagem paginada de colaboradores
feat(employees): adiciona soft delete de colaborador
test(employees): adiciona testes de integracao do repositorio
feat(document-types): adiciona cadastro de tipos de documento
feat(employee-documents): adiciona vinculacao em lote transacional
test(employee-documents): cobre rollback da vinculacao em lote
feat(submissions): adiciona envio de documento com versionamento
test(submissions): garante versao ativa unica via indice parcial
feat(submissions): traduz violacao de unicidade em conflito 409
test(submissions): cobre reenvios simultaneos com barreira de transacao
feat(employee-documents): adiciona listagem de pendentes com filtros
feat(statistics): adiciona agregacao de conformidade global
docs: adiciona readme com decisoes tecnicas e trade-offs
```

### Atribuição

Não anexe `Co-Authored-By`, "Generated with" ou qualquer trailer de atribuição.

Autoria em git é declaração de responsabilidade — quem responde pela mudança — não registro
de quem digitou os caracteres. `Co-Authored-By` é um primitivo de crédito humano: o GitHub
o renderiza como contribuidor no perfil. Aplicá-lo a uma ferramenta de desenvolvimento é
erro de categoria; ninguém escreve `Co-Authored-By: Prettier`.

Configuração em `.claude/settings.json`:

```json
{ "attribution": { "commit": "", "pr": "" } }
```

Confirme uma vez no primeiro commit com `git log -1 --format=%B`.

---

## Checklist de autorrevisão (antes de cada commit)

- [ ] O diff cobre exatamente uma task, sem melhoria adjacente carona
- [ ] Toda consulta nova com JOIN repete `AND alias.deleted_at IS NULL`
- [ ] Escrita múltipla passa pelo `TransactionRunner`
- [ ] Nenhum `DELETE FROM` e nenhum `remove()` — só soft delete
- [ ] Agregação em SQL, nada reduzido em memória
- [ ] Erro novo herda de `DomainError` e está mapeado no filter
- [ ] Teste existe, foi executado de fato, e prova o critério de aceite da task
- [ ] Mensagem de commit no padrão, sem trailer de atribuição
- [ ] `tasks.md` atualizado

---

## Checklist de varredura de soft delete (fase de fechamento)

- [ ] Listagem de colaboradores exclui removidos
- [ ] Listagem de tipos exclui removidos
- [ ] Listagem de pendentes exclui vínculos, colaboradores e tipos removidos
- [ ] Histórico de vínculo removido segue acessível por rota explícita
- [ ] Denominador de `documentsSubmittedPercentage` ignora removidos
- [ ] Denominador de `employeesFullyCompliantPercentage` ignora removidos
- [ ] "Tipos mais pendentes" ignora removidos nos três níveis
- [ ] "Últimos envios" ignora envios de vínculos removidos
- [ ] Re-vínculo após desvínculo funciona (índice parcial validado)
- [ ] Envio para vínculo removido retorna 404, não 500
- [ ] Vínculo com tipo removido é rejeitado com 404 (`EntityNotFoundError`) — **não 422**;
      `design.md` D-06 decide por não distinguir qual elo caiu, porque detalhar revelaria a
      existência de registro removido a quem não deveria vê-lo
- [ ] `grep -rn "DELETE FROM\|\.remove(" src/` não retorna nada relevante

> A garantia **contínua** contra remoção física não é este grep: é a regra ESLint
> `no-restricted-syntax` da TASK-063, que roda a cada commit e **impede** a introdução em vez
> de detectá-la depois. O grep acima é conferência manual adicional na fase de fechamento —
> pega o que a regra não alcança, como SQL montado dinamicamente. Se ele acusar algo que o
> lint deixou passar, a correção é ampliar a regra, não só apagar a linha.

---

## Estrutura do README final

1. Como rodar (`docker-compose up` + migration), validado em clone limpo
2. Diagrama do modelo e justificativa da separação vínculo × submission
3. Operações críticas enumeradas — incluindo as que **não** foram tratadas como críticas
4. Estratégia de soft delete e semântica de re-vínculo
5. Definição precisa dos dois percentuais de conformidade
6. Tratamento de concorrência e por que a garantia está no banco
7. Estratégia de testes e o que cada camada cobre
8. **O que ficou de fora e por quê** — alimentado pelas tasks `[~]` de `tasks.md`
9. O que mudaria em produção — view materializada, cache, particionamento

O item 8 é cobrado explicitamente no enunciado e quase sempre esquecido.
