import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../database/migrations/1785416355470-CreateEmployees';
import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { CreateEmployeeDocuments1785453770311 } from '../../database/migrations/1785453770311-CreateEmployeeDocuments';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { DocumentType } from '../document-types/domain/document-type.entity';
import { DocumentTypesRepository } from '../document-types/document-types.repository';
import { DocumentTypesService } from '../document-types/document-types.service';
import { Employee } from '../employees/domain/employee.entity';
import { EmployeesRepository } from '../employees/employees.repository';
import { EmployeesService } from '../employees/employees.service';
import { EmployeeDocument } from './domain/employee-document.entity';
import { EmployeeDocumentsRepository } from './employee-documents.repository';
import { EmployeeDocumentsService } from './employee-documents.service';

describe('EmployeeDocumentsService (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let service: EmployeeDocumentsService;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine').start();

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [Employee, DocumentType, EmployeeDocument],
      migrations: [
        CreateEmployees1785416355470,
        CreateDocumentTypes1785446317559,
        CreateEmployeeDocuments1785453770311,
      ],
      synchronize: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    const repository = new EmployeeDocumentsRepository(dataSource);
    const transactionRunner = new TransactionRunner(dataSource);
    const employeesService = new EmployeesService(new EmployeesRepository(dataSource));
    const documentTypesService = new DocumentTypesService(new DocumentTypesRepository(dataSource));
    service = new EmployeeDocumentsService(
      repository,
      transactionRunner,
      employeesService,
      documentTypesService,
    );
  }, 120_000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE employee_documents, employees, document_types');
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
  });
});
