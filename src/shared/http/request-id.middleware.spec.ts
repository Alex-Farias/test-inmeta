import type { NextFunction, Request, Response } from 'express';

import { RequestIdMiddleware } from './request-id.middleware';

function dublar(id?: unknown) {
  const request = { id } as Request;
  const cabecalhos = new Map<string, string>();
  const response = {
    setHeader(nome: string, valor: string) {
      cabecalhos.set(nome, valor);
    },
  } as unknown as Response;
  const next = jest.fn() as unknown as NextFunction;

  return { request, response, next, cabecalhos };
}

const FORMATO_UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

describe('RequestIdMiddleware', () => {
  const middleware = new RequestIdMiddleware();

  it('propaga o id que o pino já decidiu (request.id) para request.requestId e para o header', () => {
    const { request, response, next, cabecalhos } = dublar('id-decidido-pelo-pino');

    middleware.use(request, response, next);

    expect(request.requestId).toBe('id-decidido-pelo-pino');
    expect(cabecalhos.get('X-Request-Id')).toBe('id-decidido-pelo-pino');
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('gera um id de reserva quando request.id não existe, para nunca ficar sem id', () => {
    const { request, response, next, cabecalhos } = dublar(undefined);

    middleware.use(request, response, next);

    expect(request.requestId).toMatch(FORMATO_UUID_V4);
    expect(cabecalhos.get('X-Request-Id')).toBe(request.requestId);
  });

  it('gera um id de reserva quando request.id não é string (defesa contra o tipo ReqId do pino-http)', () => {
    const { request, response, next } = dublar(42);

    middleware.use(request, response, next);

    expect(request.requestId).toMatch(FORMATO_UUID_V4);
  });

  it('gera identificadores de reserva distintos entre requisições', () => {
    const primeira = dublar(undefined);
    const segunda = dublar(undefined);

    middleware.use(primeira.request, primeira.response, primeira.next);
    middleware.use(segunda.request, segunda.response, segunda.next);

    expect(primeira.request.requestId).not.toBe(segunda.request.requestId);
  });
});
