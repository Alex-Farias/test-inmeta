import { randomUUID } from 'node:crypto';

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

export const REQUEST_ID_HEADER = 'x-request-id';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

/**
 * Origem unica do identificador de requisicao (D-08).
 *
 * Fica em middleware, e nao no exception filter, porque o filter so roda quando
 * algo falha: se o id nascesse la, apenas respostas de erro o teriam, e
 * REQ-20.3 — mesmo id em todos os logs da requisicao, inclusive nas
 * bem-sucedidas — obrigaria a mover a geracao depois.
 *
 * Um `x-request-id` recebido e preservado, para nao quebrar a correlacao de
 * quem chama de fora ja carregando o proprio rastro.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const recebido = request.headers[REQUEST_ID_HEADER];
    const informado = Array.isArray(recebido) ? recebido[0] : recebido;

    const requestId = informado?.trim() ? informado.trim() : randomUUID();

    request.requestId = requestId;
    // Ecoado no cabecalho para que o cliente consiga citar o id ao reportar um
    // problema, mesmo numa resposta de sucesso.
    response.setHeader('X-Request-Id', requestId);

    next();
  }
}
