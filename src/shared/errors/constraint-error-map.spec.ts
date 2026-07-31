import {
  ConcurrentSubmissionError,
  DuplicatedResourceError,
  VersionConflictError,
  traduzirViolacaoDeUnicidade,
} from './index';

/** Erro do `pg` como ele chega: `code` e `constraint` na superficie. */
function violacaoDeUnicidade(constraint?: string): Error {
  return Object.assign(new Error('duplicate key value violates unique constraint'), {
    code: '23505',
    ...(constraint === undefined ? {} : { constraint }),
  });
}

describe('traduzirViolacaoDeUnicidade', () => {
  it('discrimina conflito de ativo de conflito de versão', () => {
    // O caso que da nome a D-14. As duas constraints violam com o mesmo
    // SQLSTATE; se colapsassem no mesmo erro, um defeito de calculo de versao
    // chegaria ao investigador rotulado de concorrencia.
    expect(traduzirViolacaoDeUnicidade(violacaoDeUnicidade('uq_submission_active'))).toBeInstanceOf(
      ConcurrentSubmissionError,
    );
    expect(
      traduzirViolacaoDeUnicidade(violacaoDeUnicidade('uq_submission_version')),
    ).toBeInstanceOf(VersionConflictError);
  });

  it('cai no default para unicidade não reconhecida', () => {
    // E o default que dispensa `catch` proprio em employees e document-types:
    // o filter os cobre por esta linha.
    expect(traduzirViolacaoDeUnicidade(violacaoDeUnicidade('uq_employees_email'))).toBeInstanceOf(
      DuplicatedResourceError,
    );
    expect(traduzirViolacaoDeUnicidade(violacaoDeUnicidade())).toBeInstanceOf(
      DuplicatedResourceError,
    );
  });

  it('devolve nulo para erro que não é 23505', () => {
    // `null` e "nao e comigo", nao "conflito generico": o chamador precisa
    // repropagar o original, senao queda de conexao viraria 409.
    const conexaoPerdida = Object.assign(new Error('conexao perdida'), { code: '08006' });

    expect(traduzirViolacaoDeUnicidade(conexaoPerdida)).toBeNull();
    expect(traduzirViolacaoDeUnicidade(new Error('falha qualquer'))).toBeNull();
    expect(traduzirViolacaoDeUnicidade('nem objeto e')).toBeNull();
    expect(traduzirViolacaoDeUnicidade(null)).toBeNull();
  });

  it('lê a constraint do driverError quando o erro vem embrulhado', () => {
    // `QueryFailedError` do TypeORM: nem toda versao copia os campos do driver
    // para a superficie, e sem este fallback a discriminacao viraria default
    // silenciosamente — 409 certo, codigo errado.
    const embrulhado = Object.assign(new Error('QueryFailedError'), {
      driverError: { code: '23505', constraint: 'uq_submission_version' },
    });

    expect(traduzirViolacaoDeUnicidade(embrulhado)).toBeInstanceOf(VersionConflictError);
  });
});
