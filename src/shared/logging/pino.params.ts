import { randomUUID } from 'node:crypto';

import type { Request } from 'express';
import type { Params } from 'nestjs-pino';

export const REQUEST_ID_HEADER = 'x-request-id';

/**
 * Fonte única do requestId (REQ-20.1/20.2/20.3, D-08).
 *
 * `LoggerModule` é `@Global()`, e módulo global tem middleware aplicado
 * **antes** do middleware do módulo raiz — confirmado empiricamente contra
 * `NestFactory.create` e `Test.createTestingModule`, com o mesmo resultado
 * nos dois. Ou seja: este `genReqId` roda antes de `RequestIdMiddleware`, não
 * depois, e é por isso que a geração mora aqui, não lá.
 *
 * Honra `x-request-id` recebido, para não quebrar correlação de quem chama
 * de fora; senão gera um novo. `RequestIdMiddleware` só lê o que já foi
 * decidido aqui (`request.id`) e ecoa — no header de resposta e em
 * `request.requestId`, que é o que o exception filter lê.
 */
export const pinoParams: Params = {
  pinoHttp: {
    genReqId: (req) => {
      const recebido = (req as Request).headers[REQUEST_ID_HEADER];
      const informado = Array.isArray(recebido) ? recebido[0] : recebido;

      return informado?.trim() ? informado.trim() : randomUUID();
    },
  },
};
