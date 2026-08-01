import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../database/migrations/1785416355470-CreateEmployees';
import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { CreateEmployeeDocuments1785453770311 } from '../../database/migrations/1785453770311-CreateEmployeeDocuments';
import { CreateDocumentSubmissions1785470132175 } from '../../database/migrations/1785470132175-CreateDocumentSubmissions';
import { DocumentType } from '../document-types/domain/document-type.entity';
import { Employee } from '../employees/domain/employee.entity';
import { DocumentSubmission } from '../employee-documents/domain/document-submission.entity';
import { EmployeeDocument } from '../employee-documents/domain/employee-document.entity';
import { StatisticsRepository } from './statistics.repository';

describe('StatisticsRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let repository: StatisticsRepository;

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
    repository = new StatisticsRepository(dataSource);
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

  describe('calcularConformidadeGlobal', () => {
    it('calcula os dois percentuais distintos', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);
      const employeeDocuments = dataSource.getRepository(EmployeeDocument);
      const submissions = dataSource.getRepository(DocumentSubmission);

      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const bruno = await employees.save(
        employees.create({ name: 'Bruno', email: 'bruno@example.com' }),
      );
      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      const rg = await documentTypes.save(documentTypes.create({ name: 'RG' }));

      // Ana: entrega os dois tipos exigidos -> conforme.
      const anaCpf = await employeeDocuments.save(
        employeeDocuments.create({ employeeId: ana.id, documentTypeId: cpf.id }),
      );
      const anaRg = await employeeDocuments.save(
        employeeDocuments.create({ employeeId: ana.id, documentTypeId: rg.id }),
      );
      // Bruno: entrega so um dos dois tipos exigidos -> nao conforme.
      const brunoCpf = await employeeDocuments.save(
        employeeDocuments.create({ employeeId: bruno.id, documentTypeId: cpf.id }),
      );
      await employeeDocuments.save(
        employeeDocuments.create({ employeeId: bruno.id, documentTypeId: rg.id }),
      );

      for (const vinculo of [anaCpf, anaRg, brunoCpf]) {
        await submissions.save(
          submissions.create({
            employeeDocumentId: vinculo.id,
            version: 1,
            isActive: true,
            submittedAt: new Date(),
          }),
        );
      }

      const resultado = await repository.calcularConformidadeGlobal();

      // 3 dos 4 vinculos ativos tem envio ativo.
      expect(resultado.documentsSubmittedPercentage).toBe(75);
      // 1 dos 2 colaboradores entregou todos os documentos exigidos.
      expect(resultado.employeesFullyCompliantPercentage).toBe(50);
    });

    it('nao altera o percentual ao cadastrar colaborador sem vinculo, e informa a quantidade separadamente', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);
      const employeeDocuments = dataSource.getRepository(EmployeeDocument);
      const submissions = dataSource.getRepository(DocumentSubmission);

      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));

      const anaCpf = await employeeDocuments.save(
        employeeDocuments.create({ employeeId: ana.id, documentTypeId: cpf.id }),
      );
      await submissions.save(
        submissions.create({
          employeeDocumentId: anaCpf.id,
          version: 1,
          isActive: true,
          submittedAt: new Date(),
        }),
      );

      const antes = await repository.calcularConformidadeGlobal();
      expect(antes.documentsSubmittedPercentage).toBe(100);
      expect(antes.employeesFullyCompliantPercentage).toBe(100);
      expect(antes.employeesWithoutRequirements).toBe(0);

      // Bruno nao tem nenhum vinculo ativo -> fora do denominador, contado a parte.
      await employees.save(employees.create({ name: 'Bruno', email: 'bruno@example.com' }));

      const depois = await repository.calcularConformidadeGlobal();
      expect(depois.documentsSubmittedPercentage).toBe(100);
      expect(depois.employeesFullyCompliantPercentage).toBe(100);
      expect(depois.employeesWithoutRequirements).toBe(1);
    });

    it('responde sem erro em base vazia', async () => {
      const resultado = await repository.calcularConformidadeGlobal();

      expect(resultado.documentsSubmittedPercentage).toBe(0);
      expect(resultado.employeesFullyCompliantPercentage).toBe(0);
      expect(resultado.employeesWithoutRequirements).toBe(0);
    });
  });
});
