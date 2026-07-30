import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

import { TransactionRunner } from './transaction-runner';

describe('TransactionRunner', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let runner: TransactionRunner;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine').start();

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
    });
    await dataSource.initialize();

    await dataSource.query('CREATE TABLE scratch (id SERIAL PRIMARY KEY, valor TEXT NOT NULL)');

    runner = new TransactionRunner(dataSource);
  }, 120_000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  afterEach(async () => {
    await dataSource.query('TRUNCATE TABLE scratch');
  });

  it('propaga o EntityManager e confirma escritas quando o callback resolve', async () => {
    await runner.run(async (manager) => {
      await manager.query("INSERT INTO scratch (valor) VALUES ('ok')");
    });

    const linhas = await dataSource.query<{ valor: string }[]>('SELECT valor FROM scratch');
    expect(linhas).toEqual([{ valor: 'ok' }]);
  });

  it('desfaz escritas quando o callback lança', async () => {
    await expect(
      runner.run(async (manager) => {
        await manager.query("INSERT INTO scratch (valor) VALUES ('vai sumir')");
        throw new Error('falha proposital no meio da transacao');
      }),
    ).rejects.toThrow('falha proposital no meio da transacao');

    const linhas = await dataSource.query<{ valor: string }[]>('SELECT valor FROM scratch');
    expect(linhas).toEqual([]);
  });
});
