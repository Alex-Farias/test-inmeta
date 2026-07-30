import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../database/migrations/1785416355470-CreateEmployees';
import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { CreateEmployeeDocuments1785453770311 } from '../../database/migrations/1785453770311-CreateEmployeeDocuments';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { DocumentType } from '../document-types/domain/document-type.entity';
import { Employee } from '../employees/domain/employee.entity';
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
    service = new EmployeeDocumentsService(repository, transactionRunner);
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

      // O mesmo tipo duas vezes no lote faz a segunda insercao violar
      // uq_employee_document_active a meio da transacao (D-05) — e exatamente
      // o cenario que prova REQ-15.2/15.3 sem depender da validacao de
      // duplicidade ainda nao implementada (TASK-028).
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
