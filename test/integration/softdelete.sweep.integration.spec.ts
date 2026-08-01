import { readFileSync, readdirSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource, EntityManager } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../src/database/migrations/1785416355470-CreateEmployees';
import { CreateDocumentTypes1785446317559 } from '../../src/database/migrations/1785446317559-CreateDocumentTypes';
import { CreateEmployeeDocuments1785453770311 } from '../../src/database/migrations/1785453770311-CreateEmployeeDocuments';
import { CreateDocumentSubmissions1785470132175 } from '../../src/database/migrations/1785470132175-CreateDocumentSubmissions';
import { EntityNotFoundError } from '../../src/shared/errors';
import { TransactionRunner } from '../../src/shared/transaction/transaction-runner';
import { DocumentType } from '../../src/modules/document-types/domain/document-type.entity';
import { DocumentTypesRepository } from '../../src/modules/document-types/document-types.repository';
import { DocumentTypesService } from '../../src/modules/document-types/document-types.service';
import { Employee } from '../../src/modules/employees/domain/employee.entity';
import { EmployeesRepository } from '../../src/modules/employees/employees.repository';
import { EmployeesService } from '../../src/modules/employees/employees.service';
import { DocumentSubmission } from '../../src/modules/employee-documents/domain/document-submission.entity';
import {
  DeletionCause,
  EmployeeDocument,
} from '../../src/modules/employee-documents/domain/employee-document.entity';
import { EmployeeDocumentsRepository } from '../../src/modules/employee-documents/employee-documents.repository';
import { EmployeeDocumentsService } from '../../src/modules/employee-documents/employee-documents.service';
import { SubmissionsRepository } from '../../src/modules/employee-documents/submissions.repository';
import { SubmissionsService } from '../../src/modules/employee-documents/submissions.service';
import { StatisticsRepository } from '../../src/modules/statistics/statistics.repository';

/**
 * ─── Varredura de soft delete — TASK-073, fase de fechamento ─────────────────
 *
 * Os doze itens do checklist de `convencoes.md`, um `describe` cada, na mesma
 * ordem do checklist. Cada bloco afirma o item **de fato** e registra em
 * comentario onde mais ele e provado, porque o aceite pede que cada item
 * "registre onde foi verificado".
 *
 * **Por que re-provar o que ja tem teste dedicado.** Dez dos doze itens tem
 * cobertura em suite propria. O que nenhuma delas da e a leitura conjunta: o
 * requisito de soft delete e transversal, e as suites o cobrem por modulo, de
 * modo que um item pode sumir quando uma suite e reescrita sem que nada acuse.
 * Esta varredura e o unico lugar onde os doze aparecem juntos, com o checklist
 * como indice.
 *
 * **Por que remover o pai direto pelo `DataSource`.** Onde o item fala de "pai
 * removido", a remocao e feita por SQL, sem passar pelos services que fariam a
 * cascata (TASK-032/034). Feita pelo service, a cascata ja teria marcado o
 * vinculo e o caso passaria mesmo sem JOIN nenhum — provaria a propagacao, e
 * D-06 e explicito em que a propagacao e defesa em profundidade, nao a garantia
 * primaria. Mesma tecnica de TASK-043/045/050/052/079.
 *
 * O item 12 nao e teste de banco e sim leitura do proprio `src/` — esta aqui
 * porque o checklist o lista, e como assercao em vez de grep manual para que
 * falhe sozinho.
 * ─────────────────────────────────────────────────────────────────────────────
 */
describe('Varredura de soft delete (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let employeesRepository: EmployeesRepository;
  let documentTypesRepository: DocumentTypesRepository;
  let employeeDocumentsRepository: EmployeeDocumentsRepository;
  let statisticsRepository: StatisticsRepository;
  let service: EmployeeDocumentsService;
  let submissionsService: SubmissionsService;

  const paginacao = { page: 1, limit: 20 };

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine').start();

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [Employee, DocumentType, EmployeeDocument, DocumentSubmission],
      migrations: [
        CreateEmployees1785416355470,
        CreateDocumentTypes1785446317559,
        CreateEmployeeDocuments1785453770311,
        CreateDocumentSubmissions1785470132175,
      ],
      synchronize: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    employeesRepository = new EmployeesRepository(dataSource);
    documentTypesRepository = new DocumentTypesRepository(dataSource);
    employeeDocumentsRepository = new EmployeeDocumentsRepository(dataSource);
    statisticsRepository = new StatisticsRepository(dataSource);

    const transactionRunner = new TransactionRunner(dataSource);

    // Os dois ciclos sao resolvidos como o `forwardRef` resolve em producao: a
    // referencia so e lida no momento da chamada. Mesmo wiring manual de
    // `employee-documents.integration.spec.ts`.
    const documentTypesService = new DocumentTypesService(
      documentTypesRepository,
      transactionRunner,
      {
        removerVinculosDoTipo: (documentTypeId: string, manager?: EntityManager) =>
          service.removerVinculosDoTipo(documentTypeId, manager),
      } as unknown as EmployeeDocumentsService,
    );

    const employeesService = new EmployeesService(employeesRepository, transactionRunner, {
      removerVinculosDoColaborador: (employeeId: string, manager?: EntityManager) =>
        service.removerVinculosDoColaborador(employeeId, manager),
    } as unknown as EmployeeDocumentsService);

    service = new EmployeeDocumentsService(
      employeeDocumentsRepository,
      transactionRunner,
      employeesService,
      documentTypesService,
    );

    submissionsService = new SubmissionsService(
      new SubmissionsRepository(dataSource),
      employeeDocumentsRepository,
      transactionRunner,
    );
  }, 120_000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  afterEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE document_submissions, employee_documents, employees, document_types',
    );
  });

  /** Colaborador + tipo + vinculo entre os dois, todos ativos. */
  async function montarCenario(nome: string, tipo: string) {
    const employees = dataSource.getRepository(Employee);
    const documentTypes = dataSource.getRepository(DocumentType);

    const colaborador = await employees.save(
      employees.create({ name: nome, email: `${nome.toLowerCase()}@example.com` }),
    );
    const documentType = await documentTypes.save(documentTypes.create({ name: tipo }));
    const [vinculo] = await service.vincular({
      employeeId: colaborador.id,
      documentTypeIds: [documentType.id],
    });

    return { colaborador, documentType, vinculo };
  }

  const removerPorSql = (tabela: string, id: string) =>
    dataSource.query(`UPDATE ${tabela} SET deleted_at = now() WHERE id = $1`, [id]);

  /**
   * Vinculo tem `ck_employee_documents_deletion_cause` (D-12), que amarra
   * `deleted_at` e `deletion_cause`: marcar so um dos dois viola a constraint.
   * Dai o helper proprio — a primeira versao desta varredura usava
   * `removerPorSql` aqui e cinco casos falharam na constraint, o que e o CHECK
   * fazendo exatamente o que foi desenhado para fazer.
   */
  const removerVinculoPorSql = (id: string, causa: DeletionCause = 'MANUAL') =>
    dataSource.query(
      `UPDATE employee_documents SET deleted_at = now(), deletion_cause = $2 WHERE id = $1`,
      [id, causa],
    );

  // ── 1 ──────────────────────────────────────────────────────────────────────
  // Tambem provado em `employees.repository.integration.spec.ts` →
  // "exclui removido da listagem e do total".
  describe('1. listagem de colaboradores exclui removidos', () => {
    it('colaborador removido sai da lista e do total', async () => {
      const { colaborador } = await montarCenario('Ana', 'CPF');

      const antes = await employeesRepository.findAllActive(paginacao);
      expect(antes.total).toBe(1);

      await removerPorSql('employees', colaborador.id);

      const depois = await employeesRepository.findAllActive(paginacao);
      expect(depois.total).toBe(0);
      expect(depois.items).toEqual([]);
    });
  });

  // ── 2 ──────────────────────────────────────────────────────────────────────
  // Tambem provado em `document-types.repository.integration.spec.ts` →
  // "exclui removido da listagem e do total".
  describe('2. listagem de tipos exclui removidos', () => {
    it('tipo removido sai da lista e do total', async () => {
      const { documentType } = await montarCenario('Bruno', 'RG');

      expect((await documentTypesRepository.findAllActive(paginacao)).total).toBe(1);

      await removerPorSql('document_types', documentType.id);

      const depois = await documentTypesRepository.findAllActive(paginacao);
      expect(depois.total).toBe(0);
      expect(depois.items).toEqual([]);
    });
  });

  // ── 3 ──────────────────────────────────────────────────────────────────────
  // Tambem provado em `employee-documents.repository.integration.spec.ts` →
  // "exclui pendente de colaborador removido" / "de tipo removido", e em
  // `pending.coherence.integration.spec.ts` para o vinculo desvinculado.
  //
  // Os tres niveis num `it` so: e o item do checklist que cita os tres, e
  // separa-los esconderia justamente o caso de um dos JOINs sumir.
  describe('3. listagem de pendentes exclui vinculo, colaborador e tipo removidos', () => {
    it('cada um dos tres niveis tira o vinculo de pendentes', async () => {
      const porVinculo = await montarCenario('Carla', 'CNH');
      const porColaborador = await montarCenario('Diego', 'CPF');
      const porTipo = await montarCenario('Elisa', 'RG');

      expect((await employeeDocumentsRepository.findPending(paginacao)).total).toBe(3);

      await removerVinculoPorSql(porVinculo.vinculo.id);
      await removerPorSql('employees', porColaborador.colaborador.id);
      await removerPorSql('document_types', porTipo.documentType.id);

      const depois = await employeeDocumentsRepository.findPending(paginacao);
      expect(depois.total).toBe(0);
      expect(depois.items).toEqual([]);
    });
  });

  // ── 4 ──────────────────────────────────────────────────────────────────────
  // Tambem provado em `submissions.integration.spec.ts` → "histórico segue
  // acessível após remoção do colaborador" / "do vínculo". A excecao declarada
  // a REQ-14.2: aqui o registro removido **deve** aparecer.
  describe('4. historico de vinculo removido segue acessivel por rota explicita', () => {
    it('historico responde com as versoes intactas apos remocao do vinculo', async () => {
      const { vinculo } = await montarCenario('Fabio', 'CPF');
      await submissionsService.enviar(vinculo.id); // v1
      await submissionsService.enviar(vinculo.id); // v2

      await removerVinculoPorSql(vinculo.id);

      const historico = await submissionsService.consultarHistorico(vinculo.id, paginacao);
      expect(historico.total).toBe(2);
      expect(historico.items.map((item) => item.version).sort()).toEqual([1, 2]);
    });
  });

  // ── 5 e 6 ──────────────────────────────────────────────────────────────────
  // Tambem provados em `statistics.softdelete.integration.spec.ts` →
  // "calcularConformidadeGlobal", nos tres niveis de remocao.
  //
  // Os dois percentuais no mesmo cenario porque compartilham denominador: se um
  // deles contasse removido, o outro provavelmente contaria tambem, e ver os
  // dois lado a lado e o que torna isso visivel.
  describe('5 e 6. denominadores dos dois percentuais ignoram removidos', () => {
    it('colaborador removido nao entra em nenhum dos dois denominadores', async () => {
      const cumpridor = await montarCenario('Gabriel', 'CPF');
      await submissionsService.enviar(cumpridor.vinculo.id);

      const pendente = await montarCenario('Helena', 'RG');

      // Com os dois ativos: metade dos documentos enviados, metade dos
      // colaboradores em conformidade.
      const antes = await statisticsRepository.calcularConformidadeGlobal();
      expect(antes.documentsSubmittedPercentage).toBe(50);
      expect(antes.employeesFullyCompliantPercentage).toBe(50);

      await removerPorSql('employees', pendente.colaborador.id);

      // Removido o pendente, sobra so o cumpridor: 100% nos dois.
      const depois = await statisticsRepository.calcularConformidadeGlobal();
      expect(depois.documentsSubmittedPercentage).toBe(100);
      expect(depois.employeesFullyCompliantPercentage).toBe(100);
    });
  });

  // ── 7 ──────────────────────────────────────────────────────────────────────
  // Tambem provado em `statistics.softdelete.integration.spec.ts` →
  // "ignora tipo, vinculo e colaborador removidos".
  describe('7. tipos mais pendentes ignora removidos nos tres niveis', () => {
    /**
     * **Os tres niveis nao produzem o mesmo efeito, e e proposital.** REQ-17.1
     * manda informar "para cada tipo de documento **ativo**" — entao tipo
     * removido some da lista, enquanto vinculo ou colaborador removido apenas
     * zeram a contagem do tipo, que continua aparecendo. A primeira versao
     * deste caso esperava lista vazia nos tres e falhou no terceiro; a
     * expectativa e que estava grosseira, o SQL esta correto.
     *
     * Distinguir os dois efeitos e o que da valor ao caso: uma assercao de
     * `length` sozinha passaria mesmo se o tipo removido fosse mantido com
     * contagem zerada, que e a regressao plausivel aqui.
     */
    it('tipo removido sai da lista; vinculo e colaborador removidos zeram a contagem', async () => {
      const porVinculo = await montarCenario('Igor', 'CNH');
      const porColaborador = await montarCenario('Julia', 'CPF');
      const porTipo = await montarCenario('Karina', 'RG');

      const antes = await statisticsRepository.rankingDeTiposPendentes();
      expect(antes.map((tipo) => [tipo.documentType.name, tipo.pendingCount]).sort()).toEqual([
        ['CNH', 1],
        ['CPF', 1],
        ['RG', 1],
      ]);

      await removerVinculoPorSql(porVinculo.vinculo.id);
      await removerPorSql('employees', porColaborador.colaborador.id);
      await removerPorSql('document_types', porTipo.documentType.id);

      const depois = await statisticsRepository.rankingDeTiposPendentes();

      // RG saiu inteiro (REQ-17.4, tipo removido).
      expect(depois.map((tipo) => tipo.documentType.name).sort()).toEqual(['CNH', 'CPF']);
      // CNH e CPF seguem listados, mas nao contam mais os pendentes removidos.
      expect(depois.every((tipo) => tipo.pendingCount === 0)).toBe(true);
    });
  });

  // ── 8 ──────────────────────────────────────────────────────────────────────
  // Tambem provado em `statistics.softdelete.integration.spec.ts` →
  // "ignora envios de vinculo, colaborador ou tipo removido".
  describe('8. ultimos envios ignora envios de vinculos removidos', () => {
    it('envio de vinculo removido nao aparece', async () => {
      const visivel = await montarCenario('Lucas', 'CPF');
      const oculto = await montarCenario('Marina', 'RG');
      await submissionsService.enviar(visivel.vinculo.id);
      await submissionsService.enviar(oculto.vinculo.id);

      expect((await statisticsRepository.ultimosEnvios(10)).length).toBe(2);

      await removerVinculoPorSql(oculto.vinculo.id);

      const depois = await statisticsRepository.ultimosEnvios(10);
      expect(depois.length).toBe(1);
      expect(depois[0].employee.id).toBe(visivel.colaborador.id);
    });
  });

  // ── 9 ──────────────────────────────────────────────────────────────────────
  // Comportamento tambem provado em `employee-documents.integration.spec.ts` →
  // "revincula par desvinculado sem acusar duplicidade".
  //
  // **A assercao sobre `pg_indexes` e o que esta varredura acrescenta.** As
  // outras duas tabelas com indice parcial ja tinham `describe('migration')`
  // provando a definicao (`employees`, `document_types`); `employee_documents`
  // so tinha o CHECK de `deletion_cause`. Sem o `WHERE`, o re-vinculo passaria
  // a falhar por unicidade — e o teste de comportamento acima acusaria, mas sem
  // dizer por que.
  describe('9. re-vinculo apos desvinculo funciona (indice parcial validado)', () => {
    it('uq_employee_document_active e parcial em deleted_at IS NULL', async () => {
      const indices: { indexname: string; indexdef: string }[] = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'employee_documents'`,
      );
      const definicao = new Map(indices.map((i) => [i.indexname, i.indexdef])).get(
        'uq_employee_document_active',
      );

      expect(definicao).toMatch(/CREATE UNIQUE INDEX/);
      expect(definicao).toMatch(/WHERE \(deleted_at IS NULL\)/);
    });

    it('mesmo par volta a ser vinculavel apos desvinculo', async () => {
      const { colaborador, documentType, vinculo } = await montarCenario('Nina', 'CPF');

      await service.desvincular(vinculo.id);
      const [novo] = await service.vincular({
        employeeId: colaborador.id,
        documentTypeIds: [documentType.id],
      });

      expect(novo.id).not.toBe(vinculo.id);
      expect((await employeeDocumentsRepository.findPending(paginacao)).total).toBe(1);
    });
  });

  // ── 10 ─────────────────────────────────────────────────────────────────────
  // Tambem provado em `submissions.integration.spec.ts` → "vínculo inválido".
  //
  // Afirma `EntityNotFoundError`, nao o status 404: nao ha `supertest` no
  // projeto, e a traducao erro->status e provada a parte em
  // `exception.filter.spec.ts` → "traduz cada DomainError para seu status
  // HTTP". O que este item cobra e que **nao** seja falha nao prevista (500),
  // e um `DomainError` mapeado e exatamente isso.
  describe('10. envio para vinculo removido retorna 404, nao 500', () => {
    it('vinculo removido recusa envio com erro de dominio', async () => {
      const { vinculo } = await montarCenario('Otavio', 'CPF');
      await removerVinculoPorSql(vinculo.id);

      await expect(submissionsService.enviar(vinculo.id)).rejects.toThrow(EntityNotFoundError);
    });

    it('colaborador removido recusa envio com erro de dominio', async () => {
      const { colaborador, vinculo } = await montarCenario('Paula', 'RG');
      await removerPorSql('employees', colaborador.id);

      await expect(submissionsService.enviar(vinculo.id)).rejects.toThrow(EntityNotFoundError);
    });
  });

  // ── 11 ─────────────────────────────────────────────────────────────────────
  // **O checklist dizia 422 e o codigo faz 404; o checklist e que estava
  // errado.** `design.md`, D-06: os JOINs cobrem vinculo inexistente ou
  // removido, colaborador removido e tipo removido com um 404 so, porque
  // distinguir qual elo caiu revelaria a existencia de registro removido a quem
  // nao deveria ve-lo. `BusinessRuleError` (422) nao e usado em nenhum modulo.
  // Item corrigido em `convencoes.md` na mesma task, sem mudanca de codigo.
  //
  // Tambem provado em `employee-documents.service.spec.ts`, no nivel de unidade.
  describe('11. vinculo com tipo removido e rejeitado (404, nao 422)', () => {
    it('vincular a tipo removido lanca erro de dominio e nao grava vinculo', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const colaborador = await employees.save(
        employees.create({ name: 'Rita', email: 'rita@example.com' }),
      );
      const tipo = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      await removerPorSql('document_types', tipo.id);

      await expect(
        service.vincular({ employeeId: colaborador.id, documentTypeIds: [tipo.id] }),
      ).rejects.toThrow(EntityNotFoundError);

      expect(await dataSource.getRepository(EmployeeDocument).count()).toBe(0);
    });
  });

  // ── 12 ─────────────────────────────────────────────────────────────────────
  // A garantia **continua** e a regra ESLint `no-restricted-syntax` da
  // TASK-063, que impede a introducao a cada commit. Este item e a conferencia
  // adicional que o checklist manda fazer na fase de fechamento, e pega o que a
  // regra nao alcanca — SQL montado como string, por exemplo.
  //
  // Como assercao e nao grep manual porque grep manual so falha se alguem
  // lembrar de roda-lo. Comentarios sao removidos antes da busca: hoje as
  // unicas ocorrencias no `src/` sao prosa de JSDoc explicando por que **nao**
  // se usa `.remove()`, e uma varredura que as acusasse seria ruido permanente.
  describe('12. nenhuma remocao fisica em src/', () => {
    // O nome nao repete os dois padroes literalmente porque a regra da
    // TASK-063 tambem inspeciona strings, e acusaria o titulo deste caso.
    it('nenhum arquivo de src/ tem remocao fisica fora de comentario', () => {
      const raiz = resolve(__dirname, '../../src');
      const arquivos = readdirSync(raiz, { recursive: true, encoding: 'utf8' })
        .filter((nome) => nome.endsWith('.ts'))
        .map((nome) => join(raiz, nome));

      // Sanidade: se a varredura parar de achar arquivos, o teste passaria
      // vazio e afirmaria o oposto do que se propoe.
      expect(arquivos.length).toBeGreaterThan(40);

      const semComentarios = (fonte: string) =>
        fonte.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');

      const ofensores = arquivos.filter((arquivo) => {
        const codigo = semComentarios(readFileSync(arquivo, 'utf8'));
        return /DELETE\s+FROM/i.test(codigo) || /\.remove\(/.test(codigo);
      });

      expect(ofensores).toEqual([]);
    });
  });
});
