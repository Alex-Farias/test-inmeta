import { DomainError } from './domain-error';

/**
 * Regra de dominio violada (D-08). A entrada estava bem formada — o que falhou
 * foi a regra, nao o formato. E a distincao entre 400 e 422: vincular a um tipo
 * de documento removido e um uuid perfeitamente valido apontando para um estado
 * que a regra recusa.
 */
export class BusinessRuleError extends DomainError {
  readonly code = 'BUSINESS_RULE_VIOLATION';

  constructor(message = 'Operacao viola uma regra de negocio.') {
    super(message);
  }
}
