import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { DocumentType } from './domain/document-type.entity';
import { DocumentTypesRepository } from './document-types.repository';

describe('DocumentTypesRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let repository: DocumentTypesRepository;

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
    repository = new DocumentTypesRepository(dataSource);
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

  describe('findAllActive', () => {
    it('pagina sem repetir nem omitir item', async () => {
      const repo = dataSource.getRepository(DocumentType);
      const inseridos = await Promise.all(
        Array.from({ length: 5 }, (_, indice) =>
          repo.save(repo.create({ name: `Tipo ${indice}` })),
        ),
      );

      const limit = 2;
      const idsVistos = new Set<string>();
      let total = 0;

      for (let page = 1; page <= 3; page += 1) {
        const resultado = await repository.findAllActive({ page, limit });
        resultado.items.forEach((item) => idsVistos.add(item.id));
        total = resultado.total;
      }

      expect(total).toBe(5);
      expect(idsVistos.size).toBe(5);
      expect([...idsVistos].sort()).toEqual(inseridos.map((t) => t.id).sort());
    });

    it('exclui removido da listagem e do total', async () => {
      const ativo = await repository.create({ name: 'Ativo' });
      const removido = await repository.create({ name: 'Removido' });
      await dataSource.getRepository(DocumentType).softDelete(removido.id);

      const resultado = await repository.findAllActive({ page: 1, limit: 20 });

      expect(resultado.total).toBe(1);
      expect(resultado.items.map((item) => item.id)).toEqual([ativo.id]);
    });
  });

  describe('softDelete', () => {
    it('preserva a linha apos remocao', async () => {
      const criado = await repository.create({ name: 'Cracha' });

      await repository.softDelete(criado.id);

      const linha = await dataSource
        .getRepository(DocumentType)
        .findOne({ where: { id: criado.id }, withDeleted: true });

      expect(linha).not.toBeNull();
      expect(linha?.deletedAt).not.toBeNull();
    });

    it('libera o nome apos remocao', async () => {
      const removido = await repository.create({ name: 'Certidao' });
      await repository.softDelete(removido.id);

      const novo = await repository.create({ name: 'Certidao' });

      expect(novo.id).not.toBe(removido.id);
    });
  });
});
