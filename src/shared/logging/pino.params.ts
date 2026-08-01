import { randomUUID } from 'node:crypto';

import { config as loadDotenv } from 'dotenv';
import type { Request } from 'express';
import type { Params } from 'nestjs-pino';

import { Environment } from '../../config/env.validation';

// Redundante com o `loadDotenv()` de `data-source.ts` quando este módulo é
// importado depois dele (é o caso hoje, em `app.module.ts`) — mas esse
// arquivo não deve depender de ordem de import para saber o ambiente.
// `dotenv` não sobrescreve variável já presente; chamar de novo é sem custo.
loadDotenv();

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
    /**
     * REQ-20.4. Guarda preventiva, não decorativa — mesma natureza da regra
     * de lint da TASK-063: hoje nenhum caminho de código loga corpo de
     * requisição (o serializer padrão do pino-http nem inclui `req.body`, e
     * incluí-lo à força não funciona: pino serializa o `req` vinculado ao
     * logger da requisição no instante em que o middleware do pino roda —
     * antes do body-parser preencher `request.body` —, então a linha
     * automática de "request completed" sempre veria `body: undefined`,
     * verificado subindo a aplicação de verdade). Nenhum erro de domínio
     * embute o valor do campo na mensagem (`employees.service.ts` usa texto
     * fixo, não `dto.email`). A garantia de hoje é por construção; estes
     * caminhos existem para que um log explícito futuro — de `req.body`, de
     * um objeto solto com `email`/`name`, ou de um objeto `body` — já saia
     * censurado em vez de precisar lembrar de redigir na hora.
     */
    redact: {
      paths: ['req.body.email', 'req.body.name', 'body.email', 'body.name', 'email', 'name'],
      censor: '[REDACTED]',
    },
    // REQ-20.5. `pino-pretty` só fora de produção — log legível por humano em
    // produção é log que nenhum coletor indexa (stack.md, seção "Logs").
    transport:
      process.env.NODE_ENV === Environment.Production ? undefined : { target: 'pino-pretty' },
  },
};
