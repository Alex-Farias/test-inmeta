import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource, EntityManager } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../database/migrations/1785416355470-CreateEmployees';
import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { CreateEmployeeDocuments1785453770311 } from '../../database/migrations/1785453770311-CreateEmployeeDocuments';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { EmployeeDocument } from '../employee-documents/domain/employee-document.entity';
import { EmployeeDocumentsRepository } from '../employee-documents/employee-documents.repository';
import { EmployeeDocumentsService } from '../employee-documents/employee-documents.service';
import { Employee } from '../employees/domain/employee.entity';
import { EmployeesRepository } from '../employees/employees.repository';
import { EmployeesService } from '../employees/employees.service';
import { DocumentType } from './domain/document-type.entity';
import { DocumentTypesRepository } from './document-types.repository';
import { DocumentTypesService } from './document-types.service';

describe('DocumentTypesService (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let service: DocumentTypesService;
  let employeeDocumentsService: EmployeeDocumentsService;
  let employeeDocumentsRepository: EmployeeDocumentsRepository;

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

    const transactionRunner = new TransactionRunner(dataSource);
    employeeDocumentsRepository = new EmployeeDocumentsRepository(dataSource);

    // O ciclo entre os dois services e resolvido aqui do mesmo modo que o
    // `forwardRef` resolve em producao: a referencia so e lida no momento da
    // chamada, quando ambos ja foram construidos.
    service = new DocumentTypesService(new DocumentTypesRepository(dataSource), transactionRunner, {
      removerVinculosDoTipo: (documentTypeId: string, manager?: EntityManager) =>
        employeeDocumentsService.removerVinculosDoTipo(documentTypeId, manager),
    } as unknown as EmployeeDocumentsService);

    employeeDocumentsService = new EmployeeDocumentsService(
      employeeDocumentsRepository,
      transactionRunner,
      new EmployeesService(new EmployeesRepository(dataSource), transactionRunner, {
        removerVinculosDoColaborador: (employeeId: string, manager?: EntityManager) =>
          employeeDocumentsService.removerVinculosDoColaborador(employeeId, manager),
      } as unknown as EmployeeDocumentsService),
      service,
    );
  }, 120_000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE employee_documents, employees, document_types');
  });

  describe('softDelete', () => {
    it('remove tipo e vínculos na mesma transação', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const bruno = await employees.save(
        employees.create({ name: 'Bruno', email: 'bruno@example.com' }),
      );
      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      const rg = await documentTypes.save(documentTypes.create({ name: 'RG' }));

      const [anaCpf, anaRg] = await employeeDocumentsRepository.createMany(ana.id, [cpf.id, rg.id]);
      const [brunoCpf] = await employeeDocumentsRepository.createMany(bruno.id, [cpf.id]);

      await service.softDelete(cpf.id);

      const tipo = await documentTypes.findOne({ where: { id: cpf.id }, withDeleted: true });
      expect(tipo).not.toBeNull();
      expect(tipo?.deletedAt).not.toBeNull();

      const linhas = await dataSource.getRepository(EmployeeDocument).find({ withDeleted: true });
      const porId = new Map(linhas.map((linha) => [linha.id, linha]));

      // A cascata alcanca os vinculos de todos os colaboradores que exigiam o
      // tipo, com a causa que REQ-13.3 pede.
      for (const id of [anaCpf.id, brunoCpf.id]) {
        expect(porId.get(id)?.deletedAt).not.toBeNull();
        expect(porId.get(id)?.deletionCause).toBe('TYPE_REMOVED');
      }

      // E para ali: o vinculo do outro tipo segue ativo.
      expect(porId.get(anaRg.id)?.deletedAt).toBeNull();
    });

    it('desfaz a remoção do tipo se a propagação falhar', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      await employeeDocumentsRepository.createMany(ana.id, [cpf.id]);

      // A atomicidade de REQ-13.4 so e observavel quando a segunda escrita
      // falha: sem transacao, o tipo ficaria removido e o vinculo ativo —
      // exatamente o orfao que D-04.4 existe para impedir.
      const falha = jest
        .spyOn(employeeDocumentsRepository, 'softDeleteAllByDocumentTypeId')
        .mockRejectedValueOnce(new Error('falha na propagacao'));

      await expect(service.softDelete(cpf.id)).rejects.toThrow('falha na propagacao');
      falha.mockRestore();

      const tipo = await documentTypes.findOne({ where: { id: cpf.id }, withDeleted: true });
      expect(tipo?.deletedAt).toBeNull();

      const linhas = await dataSource.getRepository(EmployeeDocument).find({ withDeleted: true });
      expect(linhas.every((linha) => linha.deletedAt === null)).toBe(true);
    });
  });
});
