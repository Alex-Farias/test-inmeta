import { DomainError } from './domain-error';

/**
 * Recurso inexistente **ou removido** (D-08). A equivalencia entre os dois casos
 * e proposital e vem de REQ-12/REQ-14: quem consulta um registro com soft delete
 * nao deve conseguir distinguir "nunca existiu" de "foi removido".
 */
export class EntityNotFoundError extends DomainError {
  readonly code = 'NOT_FOUND';

  constructor(message = 'Recurso nao encontrado.') {
    super(message);
  }
}
