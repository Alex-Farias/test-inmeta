import { DomainError } from './domain-error';

/**
 * Unicidade violada **entre registros ativos** (D-08). O "entre ativos" e o
 * ponto: os indices unicos deste projeto sao parciais, com `WHERE deleted_at IS
 * NULL`, entao um e-mail de colaborador removido nao produz este erro — produz
 * um cadastro aceito (REQ-12.5).
 */
export class DuplicatedResourceError extends DomainError {
  readonly code = 'DUPLICATED_RESOURCE';

  constructor(message = 'Ja existe um registro ativo com este valor.') {
    super(message);
  }
}
