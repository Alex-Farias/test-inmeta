import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource, EntityManager } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../database/migrations/1785416355470-CreateEmployees';
import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { CreateEmployeeDocuments1785453770311 } from '../../database/migrations/1785453770311-CreateEmployeeDocuments';
import { CreateDocumentSubmissions1785470132175 } from '../../database/migrations/1785470132175-CreateDocumentSubmissions';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
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
 * Prova REQ-15.4 (design.md §5, teste 4): com D-03, pendência não tem coluna
 * própria — é lida das submissions a cada consulta. Este teste percorre um
 * único vínculo por todas as transições que poderiam desalinhar um `status`
 * denormalizado, e confere que `listarPendentes` responde certo em cada uma,
 * pela mesma porta que a rota HTTP usa (services, não repositório direto).
 */
describe('Coerência da pendência derivada (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let employeeDocumentsService: EmployeeDocumentsService;
  let submissionsService: SubmissionsService;

  async function estaPendente(vinculoId: string): Promise<boolean> {
    const pagina = await employeeDocumentsService.listarPendentes({ page: 1, limit: 20 });
    return pagina.items.some((item) => item.id === vinculoId);
  }

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

    // Mesma resolucao manual do forwardRef de `employee-documents.integration.spec.ts`:
    // a referencia a `employeeDocumentsService` so e lida na chamada, quando o
    // service ja foi construido.
    const documentTypesService = new DocumentTypesService(
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

  it('listagem acompanha cada transição de estado', async () => {
    const employees = dataSource.getRepository(Employee);
    const documentTypes = dataSource.getRepository(DocumentType);

    const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
    const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));

    const [vinculo] = await employeeDocumentsService.vincular({
      employeeId: ana.id,
      documentTypeIds: [cpf.id],
    });

    // 1. Recem-criado, sem envio: pendente.
    expect(await estaPendente(vinculo.id)).toBe(true);

    // 2. Primeiro envio (v1 ativa): sai de pendentes.
    await submissionsService.enviar(vinculo.id);
    expect(await estaPendente(vinculo.id)).toBe(false);

    // 3. Reenvio (v2 ativa, v1 inativa): continua fora, nao volta por engano.
    await submissionsService.enviar(vinculo.id);
    expect(await estaPendente(vinculo.id)).toBe(false);

    // 4. Remove o envio ativo: nenhuma submission ativa resta, mas o historico
    // permanece (o estado que a nota da TASK-047 registrou) — volta a pendente.
    await submissionsService.removerEnvioAtivo(vinculo.id);
    expect(await estaPendente(vinculo.id)).toBe(true);

    // 5. Desvincula: o vinculo em si foi removido, nao so o envio — some de
    // pendentes por o alias principal filtrar `deleted_at`, nao por falta de envio.
    await employeeDocumentsService.desvincular(vinculo.id);
    expect(await estaPendente(vinculo.id)).toBe(false);
  });
});
