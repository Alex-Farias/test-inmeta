import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource, EntityManager } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../database/migrations/1785416355470-CreateEmployees';
import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { CreateEmployeeDocuments1785453770311 } from '../../database/migrations/1785453770311-CreateEmployeeDocuments';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { DocumentType } from '../document-types/domain/document-type.entity';
import { DocumentTypesRepository } from '../document-types/document-types.repository';
import { DocumentTypesService } from '../document-types/document-types.service';
import { EmployeeDocument } from '../employee-documents/domain/employee-document.entity';
import { EmployeeDocumentsRepository } from '../employee-documents/employee-documents.repository';
import { EmployeeDocumentsService } from '../employee-documents/employee-documents.service';
import { Employee } from './domain/employee.entity';
import { EmployeesRepository } from './employees.repository';
import { EmployeesService } from './employees.service';

describe('EmployeesService (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let service: EmployeesService;
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
    service = new EmployeesService(new EmployeesRepository(dataSource), transactionRunner, {
      removerVinculosDoColaborador: (employeeId: string, manager?: EntityManager) =>
        employeeDocumentsService.removerVinculosDoColaborador(employeeId, manager),
    } as unknown as EmployeeDocumentsService);

    employeeDocumentsService = new EmployeeDocumentsService(
      employeeDocumentsRepository,
      transactionRunner,
      service,
      new DocumentTypesService(new DocumentTypesRepository(dataSource)),
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
    it('remove colaborador e vínculos na mesma transação', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      const rg = await documentTypes.save(documentTypes.create({ name: 'RG' }));
      const vinculos = await employeeDocumentsRepository.createMany(ana.id, [cpf.id, rg.id]);

      await service.softDelete(ana.id);

      const colaborador = await employees.findOne({ where: { id: ana.id }, withDeleted: true });
      expect(colaborador).not.toBeNull();
      expect(colaborador?.deletedAt).not.toBeNull();

      const linhas = await dataSource
        .getRepository(EmployeeDocument)
        .find({ withDeleted: true, where: { employeeId: ana.id } });
      expect(linhas).toHaveLength(vinculos.length);
      for (const linha of linhas) {
        expect(linha.deletedAt).not.toBeNull();
        expect(linha.deletionCause).toBe('EMPLOYEE_REMOVED');
      }
    });

    it('desfaz a remoção do colaborador se a propagação falhar', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      await employeeDocumentsRepository.createMany(ana.id, [cpf.id]);

      // A atomicidade de REQ-12.4 so e observavel quando a segunda escrita
      // falha: sem transacao, o colaborador ficaria removido e o vinculo
      // ativo — exatamente o orfao que D-04.3 existe para impedir.
      const falha = jest
        .spyOn(employeeDocumentsRepository, 'softDeleteAllByEmployeeId')
        .mockRejectedValueOnce(new Error('falha na propagacao'));

      await expect(service.softDelete(ana.id)).rejects.toThrow('falha na propagacao');
      falha.mockRestore();

      const colaborador = await employees.findOne({ where: { id: ana.id }, withDeleted: true });
      expect(colaborador?.deletedAt).toBeNull();

      const linhas = await dataSource
        .getRepository(EmployeeDocument)
        .find({ withDeleted: true, where: { employeeId: ana.id } });
      expect(linhas.every((linha) => linha.deletedAt === null)).toBe(true);
    });
  });
});
