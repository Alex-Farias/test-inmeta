import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { DocumentType } from './domain/document-type.entity';

describe('DocumentTypesRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine').start();

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [DocumentType],
      migrations: [CreateDocumentTypes1785446317559],
      synchronize: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
  }, 120_000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE document_types');
  });

  describe('migration', () => {
    it('aplica o indice unico parcial de nome', async () => {
      const repo = dataSource.getRepository(DocumentType);

      await repo.save(repo.create({ name: 'CPF' }));

      await expect(repo.save(repo.create({ name: 'CPF' }))).rejects.toThrow();
    });

    it('nao conta tipo removido no indice parcial', async () => {
      const repo = dataSource.getRepository(DocumentType);

      const removido = await repo.save(repo.create({ name: 'ASO' }));
      await repo.softDelete(removido.id);

      await expect(repo.save(repo.create({ name: 'ASO' }))).resolves.toBeDefined();
    });
  });
});
