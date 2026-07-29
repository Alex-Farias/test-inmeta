import { DomainError } from './domain-error';

/**
 * Um campo recusado pela validacao de entrada. `reasons` e lista porque o mesmo
 * campo pode violar mais de uma restricao de uma vez.
 */
export interface ValidationDetail {
  /** Caminho do campo. Aninhado usa ponto: `endereco.cep` (D-08). */
  field: string;
  reasons: string[];
}

/**
 * Entrada malformada (D-08). Unico erro do sistema que carrega `details` — a
 * sexta chave opcional do payload, exigida por REQ-19.6 para nomear os campos
 * recusados.
 */
export class ValidationError extends DomainError {
  readonly code = 'VALIDATION_ERROR';
  readonly details: ValidationDetail[];

  constructor(message = 'Entrada invalida.', details: ValidationDetail[] = []) {
    super(message);
    this.details = details;
  }
}
