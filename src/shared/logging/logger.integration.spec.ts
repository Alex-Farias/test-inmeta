import { Writable } from 'node:stream';

import {
  Controller,
  Get,
  INestApplication,
  MiddlewareConsumer,
  Module,
  NestModule,
} from '@nestjs/common';
import { APP_FILTER } from '@nestjs/core';
import { Test } from '@nestjs/testing';
import { Logger, LoggerModule, PARAMS_PROVIDER_TOKEN } from 'nestjs-pino';

import { DomainExceptionFilter } from '../filters/domain-exception.filter';
import { RequestIdMiddleware } from '../http/request-id.middleware';
import { pinoParams } from './pino.params';

/** Captura cada linha JSON escrita pelo pino, já parseada. */
class CapturingStream extends Writable {
  readonly linhas: Record<string, unknown>[] = [];

  _write(chunk: Buffer, _encoding: string, callback: (erro?: Error | null) => void): void {
    chunk
      .toString('utf8')
      .split('\n')
      .filter((linha) => linha.trim().length > 0)
      .forEach((linha) => this.linhas.push(JSON.parse(linha) as Record<string, unknown>));
    callback();
  }
}

/** Rota que sempre falha, para exercitar tanto o log automático de requisição
 * quanto o `this.logger.error` que `DomainExceptionFilter` emite para falha
 * não prevista (REQ-19.5) — as duas devem carregar o mesmo requestId. */
@Controller()
class ProbeController {
  @Get('probe')
  probe(): never {
    throw new Error('falha proposital para provar correlacao de log');
  }
}

@Module({ controllers: [ProbeController] })
class ProbeControllerModule {}

@Module({
  imports: [LoggerModule.forRoot(pinoParams), ProbeControllerModule],
  providers: [{ provide: APP_FILTER, useClass: DomainExceptionFilter }],
})
class RootProbeModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}

describe('Logs estruturados (nestjs-pino)', () => {
  let app: INestApplication;
  const stream = new CapturingStream();

  beforeAll(async () => {
    const moduleRef = await Test.createTestingModule({
      imports: [RootProbeModule],
    })
      .overrideProvider(PARAMS_PROVIDER_TOKEN)
      .useValue({ ...pinoParams, pinoHttp: { ...pinoParams.pinoHttp, stream } })
      .compile();

    app = moduleRef.createNestApplication();
    app.useLogger(app.get(Logger));
    await app.listen(0);
  });

  afterAll(async () => {
    await app?.close();
  });

  it('usa o mesmo requestId do payload de erro', async () => {
    const url = await app.getUrl();
    const resposta = await fetch(`${url}/probe`);
    const corpo = (await resposta.json()) as { requestId: string };

    expect(resposta.status).toBe(500);
    expect(typeof corpo.requestId).toBe('string');
    expect(corpo.requestId.length).toBeGreaterThan(0);

    // REQ-20.1: cada linha emitida é JSON estruturado, não texto solto — a
    // própria captura já prova isso (JSON.parse não lançou para nenhuma).
    expect(stream.linhas.length).toBeGreaterThan(0);

    // REQ-20.2/20.3: todo log da requisição carrega o mesmo requestId
    // devolvido no corpo do erro — pelo menos duas linhas (log automático de
    // requisição/resposta do pino-http e o `this.logger.error` do filter).
    const linhasDaRequisicao = stream.linhas.filter((linha) => {
      const req = linha.req as { id?: string } | undefined;
      return req?.id === corpo.requestId;
    });

    expect(linhasDaRequisicao.length).toBeGreaterThanOrEqual(2);
  });
});
