import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource, EntityManager } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../database/migrations/1785416355470-CreateEmployees';
import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { CreateEmployeeDocuments1785453770311 } from '../../database/migrations/1785453770311-CreateEmployeeDocuments';
import { CreateDocumentSubmissions1785470132175 } from '../../database/migrations/1785470132175-CreateDocumentSubmissions';
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

/**
 * Prova REQ-13.5/REQ-14.6 de ponta a ponta, pelos services reais — ao
 * contrário de TASK-059/060, que removem direto pelo `DataSource` para isolar
 * o JOIN da cascata, aqui o que se prova é o efeito da cascata em si
 * (TASK-034), disparada por `DocumentTypesService.softDelete`.
 */
describe('Cascata de remoção de tipo preserva submissions (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let employeeDocumentsService: EmployeeDocumentsService;
  let documentTypesService: DocumentTypesService;
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

    const employeeDocumentsRepository = new EmployeeDocumentsRepository(dataSource);
    const transactionRunner = new TransactionRunner(dataSource);

    // Mesma resolucao manual do forwardRef de `pending.coherence.integration.spec.ts`.
    documentTypesService = new DocumentTypesService(
      new DocumentTypesRepository(dataSource),
      transactionRunner,
      {
        removerVinculosDoTipo: (documentTypeId: string, manager?: EntityManager) =>
          employeeDocumentsService.removerVinculosDoTipo(documentTypeId, manager),
      } as unknown as EmployeeDocumentsService,
    );

    const employeesService = new EmployeesService(
      new EmployeesRepository(dataSource),
      transactionRunner,
      {
        removerVinculosDoColaborador: (employeeId: string, manager?: EntityManager) =>
          employeeDocumentsService.removerVinculosDoColaborador(employeeId, manager),
      } as unknown as EmployeeDocumentsService,
    );

    employeeDocumentsService = new EmployeeDocumentsService(
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

  it('cascata preserva submissions históricas', async () => {
    const employees = dataSource.getRepository(Employee);
    const documentTypes = dataSource.getRepository(DocumentType);

    // Zeca e Wesley/RG: controle, fora da remocao — evita que os percentuais
    // cheguem a 0/0 por acidente, e nao por exclusao de verdade. Dois
    // colaboradores de controle (nao um so) para o total dar 4 vinculos e as
    // fracoes ficarem exatas (75% antes, 100% depois).
    const rg = await documentTypes.save(documentTypes.create({ name: 'RG' }));
    const zeca = await employees.save(
      employees.create({ name: 'Zeca', email: 'zeca@example.com' }),
    );
    const [vinculoZeca] = await employeeDocumentsService.vincular({
      employeeId: zeca.id,
      documentTypeIds: [rg.id],
    });
    await submissionsService.enviar(vinculoZeca.id);

    const wesley = await employees.save(
      employees.create({ name: 'Wesley', email: 'wesley@example.com' }),
    );
    const [vinculoWesley] = await employeeDocumentsService.vincular({
      employeeId: wesley.id,
      documentTypeIds: [rg.id],
    });
    await submissionsService.enviar(vinculoWesley.id);

    // Bruno e Carla, ambos em CPF: Bruno entrega, Carla fica pendente.
    const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
    const bruno = await employees.save(
      employees.create({ name: 'Bruno', email: 'bruno@example.com' }),
    );
    const [vinculoBruno] = await employeeDocumentsService.vincular({
      employeeId: bruno.id,
      documentTypeIds: [cpf.id],
    });
    await submissionsService.enviar(vinculoBruno.id);

    const carla = await employees.save(
      employees.create({ name: 'Carla', email: 'carla@example.com' }),
    );
    const [vinculoCarla] = await employeeDocumentsService.vincular({
      employeeId: carla.id,
      documentTypeIds: [cpf.id],
    });

    // Antes da remocao: Carla pendente aparece; 3 dos 4 vinculos/colaboradores conformes.
    const pendentesAntes = await employeeDocumentsService.listarPendentes({ page: 1, limit: 20 });
    expect(pendentesAntes.items.map((item) => item.id)).toContain(vinculoCarla.id);

    const statsAntes = await statisticsRepository.calcularConformidadeGlobal();
    expect(statsAntes.documentsSubmittedPercentage).toBe(75);
    expect(statsAntes.employeesFullyCompliantPercentage).toBe(75);

    // Remove o tipo CPF pelo service real — dispara a cascata da TASK-034.
    await documentTypesService.softDelete(cpf.id);

    // Depois: o vinculo de Carla some de pendentes...
    const pendentesDepois = await employeeDocumentsService.listarPendentes({
      page: 1,
      limit: 20,
    });
    expect(pendentesDepois.items.map((item) => item.id)).not.toContain(vinculoCarla.id);

    // ...e os dois vinculos de CPF (Bruno e Carla) somem dos dois denominadores —
    // so Zeca resta, 100/100.
    const statsDepois = await statisticsRepository.calcularConformidadeGlobal();
    expect(statsDepois.documentsSubmittedPercentage).toBe(100);
    expect(statsDepois.employeesFullyCompliantPercentage).toBe(100);

    // A submission historica do Bruno segue acessivel — a cascata para no
    // vinculo (D-06), nao alcanca document_submissions (REQ-13.5).
    const historicoBruno = await submissionsService.consultarHistorico(vinculoBruno.id, {
      page: 1,
      limit: 20,
    });
    expect(historicoBruno.total).toBe(1);
    expect(historicoBruno.items[0].deletedAt).toBeNull();
  });
});
