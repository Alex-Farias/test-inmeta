import { DomainError } from './domain-error';

/**
 * Colisao em `uq_submission_version` (D-08, D-14).
 *
 * Existe separado de `ConcurrentSubmissionError`, apesar de ambos sairem como
 * 409, porque as duas constraints sinalizam coisas diferentes:
 * `uq_submission_active` e corrida legitima de concorrencia — dois clientes
 * disputando o mesmo vinculo, e repetir resolve; `uq_submission_version` e
 * **defeito de calculo de versao** — o numero proposto ja existe no historico, e
 * repetir nao resolve nada.
 *
 * Sem esta classe, o segundo caso chegaria ao investigador rotulado de
 * concorrencia, e a investigacao comecaria pelo lugar errado.
 */
export class VersionConflictError extends DomainError {
  readonly code = 'VERSION_CONFLICT';

  constructor(message = 'Conflito de versao no historico de envios deste documento.') {
    super(message);
  }
}
