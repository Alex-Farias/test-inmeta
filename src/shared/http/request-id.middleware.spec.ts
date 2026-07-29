import type { NextFunction, Request, Response } from 'express';

import { RequestIdMiddleware } from './request-id.middleware';

function dublar(headers: Request['headers'] = {}) {
  const request = { headers } as Request;
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

  it('gera um identificador quando a requisição não traz nenhum', () => {
    const { request, response, next, cabecalhos } = dublar();

    middleware.use(request, response, next);

    expect(request.requestId).toMatch(FORMATO_UUID_V4);
    expect(cabecalhos.get('X-Request-Id')).toBe(request.requestId);
    expect(next).toHaveBeenCalledTimes(1);
  });

  it('preserva o x-request-id recebido, para não quebrar correlação externa', () => {
    const { request, response, next, cabecalhos } = dublar({ 'x-request-id': 'rastro-de-fora' });

    middleware.use(request, response, next);

    expect(request.requestId).toBe('rastro-de-fora');
    expect(cabecalhos.get('X-Request-Id')).toBe('rastro-de-fora');
  });

  it('ignora x-request-id vazio ou só com espaço e gera um novo', () => {
    const { request, response, next } = dublar({ 'x-request-id': '   ' });

    middleware.use(request, response, next);

    expect(request.requestId).toMatch(FORMATO_UUID_V4);
  });

  it('gera identificadores distintos entre requisições', () => {
    const primeira = dublar();
    const segunda = dublar();

    middleware.use(primeira.request, primeira.response, primeira.next);
    middleware.use(segunda.request, segunda.response, segunda.next);

    expect(primeira.request.requestId).not.toBe(segunda.request.requestId);
  });
});
