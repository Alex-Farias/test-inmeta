import { DomainError } from './domain-error';

/**
 * O lado perdedor de dois reenvios simultaneos (D-08).
 *
 * Existe separado de `DuplicatedResourceError`, apesar de ambos saierem como 409,
 * porque D-14 exige discriminar a constraint violada: `uq_submission_active`
 * significa corrida perdida e o cliente pode simplesmente repetir; uma unicidade
 * qualquer significa dado duplicado e repetir nao resolve. Colapsar os dois num
 * codigo so tiraria do cliente a informacao que decide se ele tenta de novo.
 */
export class ConcurrentSubmissionError extends DomainError {
  readonly code = 'CONCURRENT_SUBMISSION';

  constructor(message = 'Ja existe um envio ativo em processamento para este documento.') {
    super(message);
  }
}
