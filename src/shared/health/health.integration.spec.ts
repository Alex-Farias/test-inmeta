import { ServiceUnavailableException } from '@nestjs/common';
import { Test, TestingModule } from '@nestjs/testing';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';

import { HealthController } from './health.controller';
import { HealthModule } from './health.module';

describe('HealthController', () => {
  let container: StartedPostgreSqlContainer;
  let moduleRef: TestingModule;
  let controller: HealthController;
  let containerParado = false;

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine').start();

    moduleRef = await Test.createTestingModule({
      imports: [
        TypeOrmModule.forRoot({
          type: 'postgres',
          host: container.getHost(),
          port: container.getPort(),
          username: container.getUsername(),
          password: container.getPassword(),
          database: container.getDatabase(),
        }),
        HealthModule,
      ],
    }).compile();

    controller = moduleRef.get(HealthController);
  }, 120_000);

  afterAll(async () => {
    await moduleRef?.close().catch(() => undefined);
    if (!containerParado) {
      await container?.stop();
    }
  });

  it('reporta saudável com o banco no ar', async () => {
    const resultado = await controller.check();

    expect(resultado.status).toBe('ok');
    expect(resultado.details?.database).toMatchObject({ status: 'up' });
  });

  it('reporta não saudável com o banco fora', async () => {
    await container.stop();
    containerParado = true;

    let falha: ServiceUnavailableException | undefined;
    try {
      await controller.check();
    } catch (erro) {
      falha = erro as ServiceUnavailableException;
    }

    expect(falha).toBeInstanceOf(ServiceUnavailableException);
    const corpo = falha?.getResponse() as {
      status: string;
      details: { database: { status: string } };
    };

    expect(corpo.status).toBe('error');
    expect(corpo.details.database.status).toBe('down');
  }, 30_000);
});
