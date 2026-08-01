import { Writable } from 'node:stream';

import pino from 'pino';
import type { Options } from 'pino-http';

import { pinoParams } from './pino.params';

interface LinhaCapturada {
  [chave: string]: unknown;
}

/** Captura cada linha JSON escrita pelo pino, já parseada. */
class CapturingStream extends Writable {
  readonly linhas: LinhaCapturada[] = [];

  _write(chunk: Buffer, _encoding: string, callback: (erro?: Error | null) => void): void {
    this.linhas.push(JSON.parse(chunk.toString('utf8')) as LinhaCapturada);
    callback();
  }
}

/**
 * Testa a mesma configuração `redact` exportada por `pino.params.ts` — não
 * uma reimplementação. É guarda preventiva (ver o comentário em
 * `pino.params.ts`): hoje nada no sistema loga corpo de requisição, então
 * este teste prova o mecanismo em isolamento, não um vazamento real que
 * exista hoje — mesma natureza da regra de lint da TASK-063, testada por
 * si mesma.
 */
describe('Redação de dado pessoal nos logs (REQ-20.4)', () => {
  const redact = (pinoParams.pinoHttp as Options).redact;

  function capturar(objeto: Record<string, unknown>): LinhaCapturada {
    const stream = new CapturingStream();
    const logger = pino({ redact }, stream);

    logger.info(objeto, 'mensagem de teste');

    return stream.linhas[0];
  }

  it('redige e-mail de colaborador em req.body', () => {
    const linha = capturar({
      req: { body: { name: 'Ana Souza', email: 'ana.souza@empresa.com' } },
    });

    const corpo = linha.req as { body: Record<string, unknown> };
    expect(corpo.body.email).toBe('[REDACTED]');
    expect(corpo.body.name).toBe('[REDACTED]');

    const bruto = JSON.stringify(linha);
    expect(bruto).not.toContain('ana.souza@empresa.com');
    expect(bruto).not.toContain('Ana Souza');
  });

  it('redige e-mail e nome quando logados soltos, sem aninhar em req.body', () => {
    const linha = capturar({ email: 'solto@empresa.com', name: 'Solto', outro: 'preservado' });

    expect(linha.email).toBe('[REDACTED]');
    expect(linha.name).toBe('[REDACTED]');
    expect(linha.outro).toBe('preservado');
  });

  it('preserva campos que não são dado pessoal', () => {
    const linha = capturar({
      req: { body: { name: 'Ana', email: 'a@b.com', documentTypeId: 'abc-123' } },
    });

    const corpo = linha.req as { body: Record<string, unknown> };
    expect(corpo.body.documentTypeId).toBe('abc-123');
  });
});
