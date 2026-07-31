import {
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
  NotFoundException,
} from '@nestjs/common';

import {
  BusinessRuleError,
  ConcurrentSubmissionError,
  DomainError,
  DuplicatedResourceError,
  EntityNotFoundError,
  ValidationError,
  VersionConflictError,
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
function dublarHost(requestId = 'req-de-teste'): {
  host: ArgumentsHost;
  capturado: RespostaCapturada;
} {
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
      // Ja anexado pelo RequestIdMiddleware, que roda antes de qualquer filter.
      getRequest: () => ({ headers: {}, requestId }),
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
  ['VersionConflictError', () => new VersionConflictError(), HttpStatus.CONFLICT],
];

describe('DomainExceptionFilter', () => {
  const filter = new DomainExceptionFilter();

  // Silenciado em todos os casos: o filter registra falha nao prevista de
  // verdade, e sem isto a saida da suite fica coberta de stack esperada. Os
  // casos que precisam conferir o registro inspecionam este mesmo espiao.
  let registrarErro: jest.SpyInstance;

  beforeEach(() => {
    registrarErro = jest.spyOn(Logger.prototype, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    registrarErro.mockRestore();
  });

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
      ['VersionConflictError', 409, 'VERSION_CONFLICT'],
    ]);
  });

  it('traduz 23505 não tratado pela mesma tabela dos services', () => {
    // A rede de D-14. Nenhum modulo de cadastro tem `catch` proprio: um e-mail
    // duplicado sobe cru do driver ate aqui, e sem esta traducao viraria 500.
    const casos: Array<[string, string | undefined, number, string]> = [
      ['uq_employees_email', 'uq_employees_email', 409, 'DUPLICATED_RESOURCE'],
      ['uq_submission_active', 'uq_submission_active', 409, 'CONCURRENT_SUBMISSION'],
      ['uq_submission_version', 'uq_submission_version', 409, 'VERSION_CONFLICT'],
      ['sem nome de constraint', undefined, 409, 'DUPLICATED_RESOURCE'],
    ];

    const obtido = casos.map(([nome, constraint]) => {
      const { host, capturado } = dublarHost();
      filter.catch(
        Object.assign(new Error('duplicate key'), {
          code: '23505',
          ...(constraint === undefined ? {} : { constraint }),
        }),
        host,
      );
      return [nome, capturado.status, capturado.corpo.error];
    });

    expect(obtido).toEqual(casos.map(([nome, , status, codigo]) => [nome, status, codigo]));
  });

  it('não registra 23505 traduzido como falha não prevista', () => {
    // Depois de traduzido ele e erro de dominio, nao surpresa: logar a stack
    // encheria a saida de producao com o caminho mais banal da API.
    const { host } = dublarHost();

    filter.catch(
      Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'uq_employees_email',
      }),
      host,
    );

    expect(registrarErro).not.toHaveBeenCalled();
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

      expect(Object.keys(capturado.corpo).sort()).toEqual([
        'error',
        'message',
        'requestId',
        'statusCode',
        'timestamp',
      ]);
      expect(typeof capturado.corpo.error).toBe('string');
      expect(capturado.status).toBeGreaterThanOrEqual(400);
      expect(new Date(capturado.corpo.timestamp as string).toISOString()).toBe(
        capturado.corpo.timestamp,
      );
      expect(descricao).toBeTruthy();
    }
  });

  it('inclui requestId no payload de erro', () => {
    const origens: unknown[] = [
      new EntityNotFoundError(),
      new NotFoundException('Rota inexistente'),
      new Error('coisa inesperada'),
    ];

    for (const excecao of origens) {
      const { host, capturado } = dublarHost('9f1c2e44-7b3a-4d18-9c2f-1a5e8b0d3c77');
      filter.catch(excecao, host);

      // O mesmo id em qualquer origem de falha: e ele que liga a resposta que o
      // cliente ve a linha de log que a explica (D-08).
      expect(capturado.corpo.requestId).toBe('9f1c2e44-7b3a-4d18-9c2f-1a5e8b0d3c77');
    }
  });

  it('preserva o status que a HttpException do Nest decidiu', () => {
    const { host, capturado } = dublarHost();

    filter.catch(new HttpException('Sem permissao', HttpStatus.FORBIDDEN), host);

    expect(capturado.status).toBe(403);
    expect(capturado.corpo.error).toBe('FORBIDDEN');
  });

  it('responde 500 genérico sem expor stack', () => {
    // Um erro de driver realista: traz consulta, nome de tabela e constraint.
    //
    // Violacao de chave estrangeira, e nao mais de unicidade: a partir de D-14 o
    // filter **traduz** `23505` pela tabela de constraints, entao aquele codigo
    // deixou de ser um erro nao mapeado e nao serve mais de veiculo aqui. O que
    // este caso prova — REQ-19.4, nenhum vestigio interno no corpo — nao mudou;
    // mudou so o erro escolhido para prova-lo. O caminho do `23505` esta em
    // "traduz 23505 nao tratado pela mesma tabela dos services".
    const erroDeDriver = Object.assign(
      new Error(
        'insert or update on table "employee_documents" violates foreign key ' +
          'constraint "fk_employee_documents_employee" — ' +
          'INSERT INTO "employee_documents"("employee_id") VALUES ($1)',
      ),
      {
        code: '23503',
        table: 'employee_documents',
        constraint: 'fk_employee_documents_employee',
      },
    );

    const { host, capturado } = dublarHost();
    filter.catch(erroDeDriver, host);

    expect(capturado.status).toBe(500);
    expect(capturado.corpo.error).toBe('INTERNAL_ERROR');

    // O corpo inteiro serializado nao pode conter nenhum vestigio interno.
    const serializado = JSON.stringify(capturado.corpo);
    for (const vestigio of [
      'fk_employee_documents_employee',
      'INSERT INTO',
      'employee_documents',
      '23503',
      'foreign key',
      'at Object',
    ]) {
      expect(serializado).not.toContain(vestigio);
    }
    expect(capturado.corpo).not.toHaveProperty('stack');
  });

  it('registra a stack completa associada ao requestId da resposta', () => {
    const erro = new Error('falha crua de terceiro');
    const { host, capturado } = dublarHost('id-para-correlacionar');

    filter.catch(erro, host);

    expect(registrarErro).toHaveBeenCalledTimes(1);
    const chamada = registrarErro.mock.calls[0] as unknown[];
    const mensagem = String(chamada[0]);
    const stack = String(chamada[1]);

    // O par que fecha o caminho: o id que o cliente ve na resposta e o mesmo
    // que aparece na linha de log que carrega a stack (D-08).
    expect(mensagem).toContain('id-para-correlacionar');
    expect(capturado.corpo.requestId).toBe('id-para-correlacionar');
    expect(stack).toContain('falha crua de terceiro');
    expect(stack).toContain('exception.filter.spec.ts');
  });

  it('não registra erro de domínio como falha não prevista', () => {
    const { host } = dublarHost();

    filter.catch(new EntityNotFoundError(), host);

    // 404 de recurso ausente e operacao normal. Registrar como falha encheria o
    // log de ruido e esconderia as falhas reais.
    expect(registrarErro).not.toHaveBeenCalled();
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
