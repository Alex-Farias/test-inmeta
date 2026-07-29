import {
  BusinessRuleError,
  ConcurrentSubmissionError,
  DomainError,
  DuplicatedResourceError,
  EntityNotFoundError,
  ValidationError,
} from './index';

// A tabela e a mesma de D-08. Escrita aqui de forma independente do codigo de
// producao de proposito: se o mapeamento mudar sem passar pela decisao, o teste
// acusa em vez de acompanhar.
const errosEsperados: ReadonlyArray<[string, () => DomainError, string]> = [
  ['EntityNotFoundError', () => new EntityNotFoundError(), 'NOT_FOUND'],
  ['ValidationError', () => new ValidationError(), 'VALIDATION_ERROR'],
  ['BusinessRuleError', () => new BusinessRuleError(), 'BUSINESS_RULE_VIOLATION'],
  ['DuplicatedResourceError', () => new DuplicatedResourceError(), 'DUPLICATED_RESOURCE'],
  ['ConcurrentSubmissionError', () => new ConcurrentSubmissionError(), 'CONCURRENT_SUBMISSION'],
];

describe('hierarquia de erros de domínio', () => {
  it('cada erro de domínio expõe seu código próprio', () => {
    const codigos = errosEsperados.map(([, criar]) => criar().code);

    expect(codigos).toEqual([
      'NOT_FOUND',
      'VALIDATION_ERROR',
      'BUSINESS_RULE_VIOLATION',
      'DUPLICATED_RESOURCE',
      'CONCURRENT_SUBMISSION',
    ]);
    // Codigo repetido entre duas classes tornaria o mapeamento do filter
    // ambiguo — e o cliente nao conseguiria distinguir as falhas.
    expect(new Set(codigos).size).toBe(codigos.length);
  });

  it.each(errosEsperados)('%s herda de DomainError e de Error', (nome, criar) => {
    const erro = criar();

    expect(erro).toBeInstanceOf(DomainError);
    expect(erro).toBeInstanceOf(Error);
    // O name vem da subclasse, nao de 'Error': e o que rotula a linha de log.
    expect(erro.name).toBe(nome);
    expect(erro.stack).toBeDefined();
  });

  it('preserva a mensagem informada e oferece uma padrão quando omitida', () => {
    expect(new EntityNotFoundError('Colaborador nao encontrado.').message).toBe(
      'Colaborador nao encontrado.',
    );
    expect(new EntityNotFoundError().message).toBe('Recurso nao encontrado.');
  });

  it('só ValidationError carrega details, e vazio por padrão', () => {
    const comDetalhes = new ValidationError('Entrada invalida.', [
      { field: 'endereco.cep', reasons: ['cep deve ter 8 digitos'] },
    ]);

    expect(comDetalhes.details).toEqual([
      { field: 'endereco.cep', reasons: ['cep deve ter 8 digitos'] },
    ]);
    expect(new ValidationError().details).toEqual([]);

    // D-08: nenhum outro tipo de erro carrega details.
    const outros = errosEsperados
      .filter(([nome]) => nome !== 'ValidationError')
      .map(([, criar]) => criar());
    for (const erro of outros) {
      expect(erro).not.toHaveProperty('details');
    }
  });
});
