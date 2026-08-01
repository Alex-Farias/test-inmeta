import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource, EntityManager } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../database/migrations/1785416355470-CreateEmployees';
import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { CreateEmployeeDocuments1785453770311 } from '../../database/migrations/1785453770311-CreateEmployeeDocuments';
import { CreateDocumentSubmissions1785470132175 } from '../../database/migrations/1785470132175-CreateDocumentSubmissions';
import { EntityNotFoundError } from '../../shared/errors';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { StatisticsRepository } from '../statistics/statistics.repository';
import { DocumentType } from '../document-types/domain/document-type.entity';
import { DocumentTypesRepository } from '../document-types/document-types.repository';
import { DocumentTypesService } from '../document-types/document-types.service';
import { Employee } from '../employees/domain/employee.entity';
import { EmployeesRepository } from '../employees/employees.repository';
import { EmployeesService } from '../employees/employees.service';
import { DocumentSubmission } from './domain/document-submission.entity';
import { EmployeeDocument } from './domain/employee-document.entity';
import { EmployeeDocumentsRepository } from './employee-documents.repository';
import { EmployeeDocumentsService } from './employee-documents.service';
import { SubmissionsRepository } from './submissions.repository';
import { SubmissionsService } from './submissions.service';

describe('EmployeeDocumentsService (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let service: EmployeeDocumentsService;
  let submissionsService: SubmissionsService;
  let statisticsRepository: StatisticsRepository;

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

    const repository = new EmployeeDocumentsRepository(dataSource);
    const transactionRunner = new TransactionRunner(dataSource);
    // Os dois ciclos sao resolvidos aqui do mesmo modo que o `forwardRef`
    // resolve em producao: a referencia so e lida no momento da chamada,
    // quando ambos ja foram construidos.
    const documentTypesService = new DocumentTypesService(
      new DocumentTypesRepository(dataSource),
      transactionRunner,
      {
        removerVinculosDoTipo: (documentTypeId: string, manager?: EntityManager) =>
          service.removerVinculosDoTipo(documentTypeId, manager),
      } as unknown as EmployeeDocumentsService,
    );

    const employeesService = new EmployeesService(
      new EmployeesRepository(dataSource),
      transactionRunner,
      {
        removerVinculosDoColaborador: (employeeId: string, manager?: EntityManager) =>
          service.removerVinculosDoColaborador(employeeId, manager),
      } as unknown as EmployeeDocumentsService,
    );

    service = new EmployeeDocumentsService(
      repository,
      transactionRunner,
      employeesService,
      documentTypesService,
    );

    submissionsService = new SubmissionsService(
      new SubmissionsRepository(dataSource),
      repository,
      transactionRunner,
    );

    statisticsRepository = new StatisticsRepository(dataSource);
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

  describe('vincular', () => {
    it('falha no meio do lote não deixa vínculo parcial', async () => {
      const employee = await dataSource
        .getRepository(Employee)
        .save(dataSource.getRepository(Employee).create({ name: 'Ana', email: 'ana@example.com' }));
      const documentType = await dataSource
        .getRepository(DocumentType)
        .save(dataSource.getRepository(DocumentType).create({ name: 'CPF' }));

      // O mesmo tipo duas vezes no lote passa pela validacao de duplicidade
      // (TASK-028 so rejeita vinculo ja ativo em employee_documents, nao
      // repeticao dentro do proprio payload) e faz a segunda insercao violar
      // uq_employee_document_active a meio da transacao (D-05) — prova
      // REQ-15.2/15.3.
      await expect(
        service.vincular({
          employeeId: employee.id,
          documentTypeIds: [documentType.id, documentType.id],
        }),
      ).rejects.toThrow();

      const vinculos = await dataSource.getRepository(EmployeeDocument).find();
      expect(vinculos).toEqual([]);
    });

    it('revincula par desvinculado sem acusar duplicidade', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));

      const [anterior] = await service.vincular({
        employeeId: ana.id,
        documentTypeIds: [cpf.id],
      });
      await service.desvincular(anterior.id);

      // O criterio de REQ-05.1 e sobre a operacao `vincular`, nao sobre o
      // INSERT: a checagem de duplicidade de TASK-028 nao pode acusar o
      // vinculo removido como conflito. E o que quebraria se
      // `findActiveDocumentTypeIds` passasse a enxergar removidos.
      const [novo] = await service.vincular({
        employeeId: ana.id,
        documentTypeIds: [cpf.id],
      });

      expect(novo.id).not.toBe(anterior.id);

      const ativos = await dataSource.getRepository(EmployeeDocument).find();
      expect(ativos).toHaveLength(1);
      expect(ativos[0].id).toBe(novo.id);
    });
  });

  describe('re-vínculo', () => {
    it('vínculo anterior não conta para pendência', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      const rg = await documentTypes.save(documentTypes.create({ name: 'RG' }));

      // Bruno, controle: entrega RG, sempre conforme — evita 0/0 por acidente.
      const bruno = await employees.save(
        employees.create({ name: 'Bruno', email: 'bruno@example.com' }),
      );
      const [vinculoBruno] = await service.vincular({
        employeeId: bruno.id,
        documentTypeIds: [rg.id],
      });
      await submissionsService.enviar(vinculoBruno.id);

      // Ana vincula CPF e fica pendente (sem envio).
      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const [anterior] = await service.vincular({
        employeeId: ana.id,
        documentTypeIds: [cpf.id],
      });

      const pendentesAntes = await service.listarPendentes({ page: 1, limit: 20 });
      expect(pendentesAntes.items.map((item) => item.id)).toContain(anterior.id);

      const statsAntes = await statisticsRepository.calcularConformidadeGlobal();
      expect(statsAntes.documentsSubmittedPercentage).toBe(50);
      expect(statsAntes.employeesFullyCompliantPercentage).toBe(50);

      // Desvincula e revincula ao mesmo tipo: vinculo novo, tambem pendente.
      await service.desvincular(anterior.id);
      const [novo] = await service.vincular({
        employeeId: ana.id,
        documentTypeIds: [cpf.id],
      });

      const pendentesDepois = await service.listarPendentes({ page: 1, limit: 20 });
      expect(pendentesDepois.items.map((item) => item.id)).toContain(novo.id);
      expect(pendentesDepois.items.map((item) => item.id)).not.toContain(anterior.id);

      // O antigo nao soma ao lado do novo: se ainda contasse, o denominador
      // teria 3 vinculos (33%/33%), nao 2 (50%/50%) — e a assercao que pega
      // o vinculo removido contando por engano.
      const statsDepois = await statisticsRepository.calcularConformidadeGlobal();
      expect(statsDepois.documentsSubmittedPercentage).toBe(50);
      expect(statsDepois.employeesFullyCompliantPercentage).toBe(50);
    });

    it('vínculo novo reinicia a numeração de versões', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      const carla = await employees.save(
        employees.create({ name: 'Carla', email: 'carla@example.com' }),
      );

      const [anterior] = await service.vincular({
        employeeId: carla.id,
        documentTypeIds: [cpf.id],
      });
      await submissionsService.enviar(anterior.id); // v1
      await submissionsService.enviar(anterior.id); // v2 (reenvio)

      await service.desvincular(anterior.id);
      const [novo] = await service.vincular({
        employeeId: carla.id,
        documentTypeIds: [cpf.id],
      });

      // Numeracao por vinculo (D-07): o novo comeca em 1, nao em 3.
      const primeiroEnvioDoNovo = await submissionsService.enviar(novo.id);
      expect(primeiroEnvioDoNovo.version).toBe(1);

      // O vinculo antigo segue consultavel, com as duas versoes intactas (REQ-05.3).
      const historicoAnterior = await submissionsService.consultarHistorico(anterior.id, {
        page: 1,
        limit: 20,
      });
      expect(historicoAnterior.total).toBe(2);
      expect(historicoAnterior.items.map((item) => item.version).sort()).toEqual([1, 2]);
    });
  });

  /**
   * REQ-14.8 no caminho de desvinculacao (TASK-079). A simetria com o envio
   * estava faltando: `desvincular` resolvia o vinculo por uma consulta sem
   * JOIN, entao um vinculo de colaborador ou tipo removido — mas ainda nao
   * marcado — passava, e a operacao seguia como se a cadeia estivesse viva.
   *
   * **O pai e removido direto pelo `DataSource`, sem passar pelo service.**
   * Mesmo padrao de falsificacao de `submissions.integration.spec.ts` e da
   * decisao em `design.md`, D-06: feito pelo service, a cascata ja teria
   * marcado o vinculo e o caso passaria mesmo sem JOIN nenhum — provaria a
   * propagacao, nao o requisito. Removendo o pai por fora, o unico motivo pelo
   * qual o vinculo e recusado sao os JOINs de `findSubmittableById`.
   *
   * Falsificado antes de commitar: revertido `desvincular` para a consulta sem
   * JOIN, os dois casos abaixo falham — a desvinculacao e aceita e grava
   * `deletion_cause = 'MANUAL'` — enquanto "vinculo ja removido" em
   * `employee-documents.service.spec.ts` continua passando, porque esse o
   * filtro do alias principal ja cobre. E a medida exata do que os JOINs
   * acrescentam aqui.
   */
  describe('desvincular com cadeia inativa', () => {
    it('recusa desvinculação de vínculo com colaborador removido', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      const diego = await employees.save(
        employees.create({ name: 'Diego', email: 'diego@example.com' }),
      );
      const [vinculo] = await service.vincular({
        employeeId: diego.id,
        documentTypeIds: [cpf.id],
      });

      // Sem cascata: so o colaborador e marcado, o vinculo segue ativo.
      await dataSource.query('UPDATE employees SET deleted_at = now() WHERE id = $1', [diego.id]);

      await expect(service.desvincular(vinculo.id)).rejects.toThrow(EntityNotFoundError);

      // Nenhuma escrita aconteceu: o vinculo continua sem causa de remocao.
      const persistido = await dataSource
        .getRepository(EmployeeDocument)
        .findOne({ where: { id: vinculo.id }, withDeleted: true });
      expect(persistido?.deletedAt).toBeNull();
      expect(persistido?.deletionCause).toBeNull();
    });

    it('recusa desvinculação de vínculo com tipo removido', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const rg = await documentTypes.save(documentTypes.create({ name: 'RG' }));
      const elisa = await employees.save(
        employees.create({ name: 'Elisa', email: 'elisa@example.com' }),
      );
      const [vinculo] = await service.vincular({
        employeeId: elisa.id,
        documentTypeIds: [rg.id],
      });

      await dataSource.query('UPDATE document_types SET deleted_at = now() WHERE id = $1', [rg.id]);

      await expect(service.desvincular(vinculo.id)).rejects.toThrow(EntityNotFoundError);

      const persistido = await dataSource
        .getRepository(EmployeeDocument)
        .findOne({ where: { id: vinculo.id }, withDeleted: true });
      expect(persistido?.deletedAt).toBeNull();
      expect(persistido?.deletionCause).toBeNull();
    });
  });
});
