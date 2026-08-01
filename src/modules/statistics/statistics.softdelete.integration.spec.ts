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

/**
 * Varredura de soft delete das três leituras do módulo (D-06). Remove
 * colaborador/tipo/vínculo **direto pelo `DataSource`**, sem passar pelos
 * services que fariam a cascata (TASK-032/034) — mesma técnica de
 * TASK-043/045/050/052: isola o que o `JOIN ... AND deleted_at IS NULL`
 * garante do que a propagação mascararia.
 */
describe('StatisticsRepository — soft delete (integration)', () => {
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
    it('colaborador removido sai do denominador', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);
      const employeeDocuments = dataSource.getRepository(EmployeeDocument);
      const submissions = dataSource.getRepository(DocumentSubmission);

      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      const rg = await documentTypes.save(documentTypes.create({ name: 'RG' }));

      // Carla: controle, sempre conforme — o percentual nao chega a 0/0 por acidente.
      const carla = await employees.save(
        employees.create({ name: 'Carla', email: 'carla@example.com' }),
      );
      const vinculoCarla = await employeeDocuments.save(
        employeeDocuments.create({ employeeId: carla.id, documentTypeId: cpf.id }),
      );
      await submissions.save(
        submissions.create({
          employeeDocumentId: vinculoCarla.id,
          version: 1,
          isActive: true,
          submittedAt: new Date(),
        }),
      );

      // Ana: nao entregue — se a exclusao falhar, o percentual final fica abaixo de 100.
      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      await employeeDocuments.save(
        employeeDocuments.create({ employeeId: ana.id, documentTypeId: rg.id }),
      );

      const antes = await repository.calcularConformidadeGlobal();
      expect(antes.documentsSubmittedPercentage).toBe(50);
      expect(antes.employeesFullyCompliantPercentage).toBe(50);

      // Remove Ana direto pelo DataSource — sem passar por EmployeesService.softDelete
      // (TASK-032), que propagaria a remocao ao vinculo. O que prova a exclusao aqui e o
      // JOIN, nao a cascata.
      await employees.softDelete(ana.id);

      const depois = await repository.calcularConformidadeGlobal();
      expect(depois.documentsSubmittedPercentage).toBe(100);
      expect(depois.employeesFullyCompliantPercentage).toBe(100);
    });

    it('tipo removido sai do denominador', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);
      const employeeDocuments = dataSource.getRepository(EmployeeDocument);
      const submissions = dataSource.getRepository(DocumentSubmission);

      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      const cnh = await documentTypes.save(documentTypes.create({ name: 'CNH' }));

      const carla = await employees.save(
        employees.create({ name: 'Carla', email: 'carla@example.com' }),
      );
      const vinculoCarla = await employeeDocuments.save(
        employeeDocuments.create({ employeeId: carla.id, documentTypeId: cpf.id }),
      );
      await submissions.save(
        submissions.create({
          employeeDocumentId: vinculoCarla.id,
          version: 1,
          isActive: true,
          submittedAt: new Date(),
        }),
      );

      const bruno = await employees.save(
        employees.create({ name: 'Bruno', email: 'bruno@example.com' }),
      );
      await employeeDocuments.save(
        employeeDocuments.create({ employeeId: bruno.id, documentTypeId: cnh.id }),
      );

      const antes = await repository.calcularConformidadeGlobal();
      expect(antes.documentsSubmittedPercentage).toBe(50);
      expect(antes.employeesFullyCompliantPercentage).toBe(50);

      // Remove CNH direto pelo DataSource — sem passar por DocumentTypesService.softDelete
      // (TASK-034), que propagaria a remocao ao vinculo.
      await documentTypes.softDelete(cnh.id);

      const depois = await repository.calcularConformidadeGlobal();
      expect(depois.documentsSubmittedPercentage).toBe(100);
      expect(depois.employeesFullyCompliantPercentage).toBe(100);
    });

    it('vinculo removido sai do denominador', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);
      const employeeDocuments = dataSource.getRepository(EmployeeDocument);
      const submissions = dataSource.getRepository(DocumentSubmission);

      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      const id = await documentTypes.save(documentTypes.create({ name: 'Identidade' }));

      const carla = await employees.save(
        employees.create({ name: 'Carla', email: 'carla@example.com' }),
      );
      const vinculoCarla = await employeeDocuments.save(
        employeeDocuments.create({ employeeId: carla.id, documentTypeId: cpf.id }),
      );
      await submissions.save(
        submissions.create({
          employeeDocumentId: vinculoCarla.id,
          version: 1,
          isActive: true,
          submittedAt: new Date(),
        }),
      );

      const david = await employees.save(
        employees.create({ name: 'David', email: 'david@example.com' }),
      );
      const vinculoDavid = await employeeDocuments.save(
        employeeDocuments.create({ employeeId: david.id, documentTypeId: id.id }),
      );

      const antes = await repository.calcularConformidadeGlobal();
      expect(antes.documentsSubmittedPercentage).toBe(50);
      expect(antes.employeesFullyCompliantPercentage).toBe(50);

      // Remove so o vinculo, direto pelo DataSource (desvinculacao manual real, REQ-04).
      // `deletionCause` obrigatorio junto de `deletedAt` — CHECK ck_employee_documents_
      // deletion_cause (D-12) — por isso `update`, nao `softDelete` cru.
      await employeeDocuments.update(vinculoDavid.id, {
        deletedAt: new Date(),
        deletionCause: 'MANUAL',
      });

      const depois = await repository.calcularConformidadeGlobal();
      expect(depois.documentsSubmittedPercentage).toBe(100);
      expect(depois.employeesFullyCompliantPercentage).toBe(100);
    });
  });
});
