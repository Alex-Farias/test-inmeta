import { ArgumentsHost, HttpException, HttpStatus, NotFoundException } from '@nestjs/common';

import {
  BusinessRuleError,
  ConcurrentSubmissionError,
  DomainError,
  DuplicatedResourceError,
  EntityNotFoundError,
  ValidationError,
} from '../errors';
import { DomainExceptionFilter } from './domain-exception.filter';

interface RespostaCapturada {
  status: number;
  corpo: Record<string, unknown>;
}

/**
 * Dubla apenas o que o filter consome do ArgumentsHost. Um TestingModule
 * completo aqui exigiria subir HTTP para provar uma tabela de traducao.
 */
function dublarHost(): { host: ArgumentsHost; capturado: RespostaCapturada } {
  const capturado: RespostaCapturada = { status: 0, corpo: {} };

  const response = {
    status(codigo: number) {
      capturado.status = codigo;
      return this;
    },
    json(corpo: Record<string, unknown>) {
      capturado.corpo = corpo;
      return this;
    },
  };

  const host = {
    switchToHttp: () => ({
      getResponse: () => response,
      getRequest: () => ({ headers: {} }),
    }),
  } as unknown as ArgumentsHost;

  return { host, capturado };
}

// A tabela de D-08, escrita independente do codigo de producao.
const mapeamento: ReadonlyArray<[string, () => DomainError, HttpStatus]> = [
  ['EntityNotFoundError', () => new EntityNotFoundError(), HttpStatus.NOT_FOUND],
  ['ValidationError', () => new ValidationError(), HttpStatus.BAD_REQUEST],
  ['BusinessRuleError', () => new BusinessRuleError(), HttpStatus.UNPROCESSABLE_ENTITY],
  ['DuplicatedResourceError', () => new DuplicatedResourceError(), HttpStatus.CONFLICT],
  ['ConcurrentSubmissionError', () => new ConcurrentSubmissionError(), HttpStatus.CONFLICT],
];

describe('DomainExceptionFilter', () => {
  const filter = new DomainExceptionFilter();

  it('traduz cada DomainError para seu status HTTP', () => {
    const obtido = mapeamento.map(([nome, criar]) => {
      const { host, capturado } = dublarHost();
      filter.catch(criar(), host);
      return [nome, capturado.status, capturado.corpo.error];
    });

    expect(obtido).toEqual([
      ['EntityNotFoundError', 404, 'NOT_FOUND'],
      ['ValidationError', 400, 'VALIDATION_ERROR'],
      ['BusinessRuleError', 422, 'BUSINESS_RULE_VIOLATION'],
      ['DuplicatedResourceError', 409, 'DUPLICATED_RESOURCE'],
      ['ConcurrentSubmissionError', 409, 'CONCURRENT_SUBMISSION'],
    ]);
  });

  it('responde no mesmo formato qualquer que seja a origem da falha', () => {
    const origens: Array<[string, unknown]> = [
      ['erro de domínio', new BusinessRuleError('Regra violada.')],
      ['HttpException do Nest', new NotFoundException('Rota inexistente')],
      ['erro cru de terceiro', new Error('coisa inesperada')],
    ];

    for (const [descricao, excecao] of origens) {
      const { host, capturado } = dublarHost();
      filter.catch(excecao, host);

      expect(Object.keys(capturado.corpo).sort()).toEqual(
        ['error', 'message', 'statusCode', 'timestamp'],
        // A mensagem do expect nao aceita contexto extra; o describe cobre.
      );
      expect(typeof capturado.corpo.error).toBe('string');
      expect(capturado.status).toBeGreaterThanOrEqual(400);
      expect(new Date(capturado.corpo.timestamp as string).toISOString()).toBe(
        capturado.corpo.timestamp,
      );
      expect(descricao).toBeTruthy();
    }
  });

  it('preserva o status que a HttpException do Nest decidiu', () => {
    const { host, capturado } = dublarHost();

    filter.catch(new HttpException('Sem permissao', HttpStatus.FORBIDDEN), host);

    expect(capturado.status).toBe(403);
    expect(capturado.corpo.error).toBe('FORBIDDEN');
  });

  it('inclui details apenas quando o erro de validação os traz', () => {
    const { host: comDetalhes, capturado: corpoComDetalhes } = dublarHost();
    filter.catch(
      new ValidationError('Entrada invalida.', [{ field: 'email', reasons: ['obrigatorio'] }]),
      comDetalhes,
    );

    const { host: semDetalhes, capturado: corpoSemDetalhes } = dublarHost();
    filter.catch(new DuplicatedResourceError(), semDetalhes);

    expect(corpoComDetalhes.corpo.details).toEqual([{ field: 'email', reasons: ['obrigatorio'] }]);
    expect(corpoSemDetalhes.corpo).not.toHaveProperty('details');
  });
});
