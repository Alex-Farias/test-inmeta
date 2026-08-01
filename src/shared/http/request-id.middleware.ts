import { randomUUID } from 'node:crypto';

import { Injectable, NestMiddleware } from '@nestjs/common';
import type { NextFunction, Request, Response } from 'express';

declare module 'express-serve-static-core' {
  interface Request {
    requestId?: string;
  }
}

/**
 * Não gera mais o id (D-08) — quem decide é `pino.params.ts#genReqId`. A
 * geração migrou para lá porque `LoggerModule` do nestjs-pino é `@Global()`,
 * e módulo global tem middleware aplicado antes do módulo raiz: quando este
 * middleware roda, `request.id` já foi decidido pelo pino. Ver o comentário
 * em `pino.params.ts` para a explicação completa.
 *
 * Este middleware só garante que o id existe em `request.requestId` — com
 * fallback próprio caso o pino não esteja no ar, para não deixar a requisição
 * sem id em silêncio — e o ecoa no cabeçalho de resposta.
 */
@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(request: Request, response: Response, next: NextFunction): void {
    const requestId =
      typeof request.id === 'string' && request.id.trim() ? request.id : randomUUID();

    request.requestId = requestId;
    response.setHeader('X-Request-Id', requestId);

    next();
  }
}
