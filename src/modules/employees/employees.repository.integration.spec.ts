import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../database/migrations/1785416355470-CreateEmployees';
import { Employee } from './domain/employee.entity';
import { EmployeesRepository } from './employees.repository';

describe('EmployeesRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let repository: EmployeesRepository;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine').start();

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [Employee],
      migrations: [CreateEmployees1785416355470],
      synchronize: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();
    repository = new EmployeesRepository(dataSource);
  }, 120_000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE employees');
  });

  describe('migration', () => {
    it('aplica o indice unico parcial de e-mail', async () => {
      const repo = dataSource.getRepository(Employee);

      await repo.save(repo.create({ name: 'Ana', email: 'ana@example.com' }));

      await expect(
        repo.save(repo.create({ name: 'Ana Duplicada', email: 'ana@example.com' })),
      ).rejects.toThrow();
    });

    it('nao conta colaborador removido no indice parcial', async () => {
      const repo = dataSource.getRepository(Employee);

      const removido = await repo.save(repo.create({ name: 'Bruno', email: 'bruno@example.com' }));
      await repo.softDelete(removido.id);

      await expect(
        repo.save(repo.create({ name: 'Bruno Novo', email: 'bruno@example.com' })),
      ).resolves.toBeDefined();
    });
  });

  describe('findAllActive', () => {
    it('pagina sem repetir nem omitir item', async () => {
      const repo = dataSource.getRepository(Employee);
      const inseridos = await Promise.all(
        Array.from({ length: 5 }, (_, indice) =>
          repo.save(
            repo.create({
              name: `Colaborador ${indice}`,
              email: `colaborador${indice}@example.com`,
            }),
          ),
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
      expect([...idsVistos].sort()).toEqual(inseridos.map((e) => e.id).sort());
    });
  });
});
