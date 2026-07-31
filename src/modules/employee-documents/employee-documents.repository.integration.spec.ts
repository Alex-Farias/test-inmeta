import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../database/migrations/1785416355470-CreateEmployees';
import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { CreateEmployeeDocuments1785453770311 } from '../../database/migrations/1785453770311-CreateEmployeeDocuments';
import { DocumentType } from '../document-types/domain/document-type.entity';
import { Employee } from '../employees/domain/employee.entity';
import { EmployeeDocument } from './domain/employee-document.entity';
import { EmployeeDocumentsRepository } from './employee-documents.repository';

describe('EmployeeDocumentsRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let repository: EmployeeDocumentsRepository;

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
    repository = new EmployeeDocumentsRepository(dataSource);
  }, 120_000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE employee_documents, employees, document_types');
  });

  describe('migration', () => {
    it('rejeita vínculo removido sem causa de remoção', async () => {
      const employee = await dataSource
        .getRepository(Employee)
        .save(dataSource.getRepository(Employee).create({ name: 'Ana', email: 'ana@example.com' }));
      const documentType = await dataSource
        .getRepository(DocumentType)
        .save(dataSource.getRepository(DocumentType).create({ name: 'CPF' }));

      await expect(
        dataSource.query(
          `INSERT INTO employee_documents (employee_id, document_type_id, deleted_at, deletion_cause)
           VALUES ($1, $2, now(), NULL)`,
          [employee.id, documentType.id],
        ),
      ).rejects.toThrow();
    });
  });

  describe('desvincular', () => {
    it('grava causa MANUAL na desvinculação', async () => {
      const employee = await dataSource
        .getRepository(Employee)
        .save(dataSource.getRepository(Employee).create({ name: 'Ana', email: 'ana@example.com' }));
      const documentType = await dataSource
        .getRepository(DocumentType)
        .save(dataSource.getRepository(DocumentType).create({ name: 'CPF' }));
      const [vinculo] = await repository.createMany(employee.id, [documentType.id]);

      await repository.softDelete(vinculo.id, 'MANUAL');

      const linha = await dataSource
        .getRepository(EmployeeDocument)
        .findOne({ where: { id: vinculo.id }, withDeleted: true });

      expect(linha?.deletedAt).not.toBeNull();
      expect(linha?.deletionCause).toBe('MANUAL');
    });
  });

  describe('softDeleteAllByEmployeeId', () => {
    it('remove todos os vínculos ativos do colaborador', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const bruno = await employees.save(
        employees.create({ name: 'Bruno', email: 'bruno@example.com' }),
      );
      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      const rg = await documentTypes.save(documentTypes.create({ name: 'RG' }));

      const [anaCpf, anaRg] = await repository.createMany(ana.id, [cpf.id, rg.id]);
      const [brunoCpf] = await repository.createMany(bruno.id, [cpf.id]);

      await repository.softDeleteAllByEmployeeId(ana.id, 'EMPLOYEE_REMOVED');

      const linhas = await dataSource
        .getRepository(EmployeeDocument)
        .find({ withDeleted: true, order: { createdAt: 'ASC' } });
      const porId = new Map(linhas.map((linha) => [linha.id, linha]));

      for (const id of [anaCpf.id, anaRg.id]) {
        expect(porId.get(id)?.deletedAt).not.toBeNull();
        expect(porId.get(id)?.deletionCause).toBe('EMPLOYEE_REMOVED');
      }

      // Isolamento: o criterio filtra por colaborador, nao remove a tabela toda.
      expect(porId.get(brunoCpf.id)?.deletedAt).toBeNull();
      expect(porId.get(brunoCpf.id)?.deletionCause).toBeNull();
    });

    it('preserva a causa de vínculo já desvinculado manualmente', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      const rg = await documentTypes.save(documentTypes.create({ name: 'RG' }));

      const [anaCpf, anaRg] = await repository.createMany(ana.id, [cpf.id, rg.id]);
      await repository.softDelete(anaCpf.id, 'MANUAL');

      await repository.softDeleteAllByEmployeeId(ana.id, 'EMPLOYEE_REMOVED');

      const linhas = await dataSource.getRepository(EmployeeDocument).find({ withDeleted: true });
      const porId = new Map(linhas.map((linha) => [linha.id, linha]));

      // `deletedAt: IsNull()` no criterio: a cascata nao reescreve o que ja
      // estava removido, senao a distincao de D-12 se perderia.
      expect(porId.get(anaCpf.id)?.deletionCause).toBe('MANUAL');
      expect(porId.get(anaRg.id)?.deletionCause).toBe('EMPLOYEE_REMOVED');
    });
  });
});
