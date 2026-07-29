/**
 * Raiz da hierarquia de erros de dominio (D-08).
 *
 * Deliberadamente **agnostica de HTTP**: nao ha status aqui. Um erro sabe o que
 * aconteceu no dominio e nada sobre o protocolo que vai transporta-lo. A
 * traducao para status vive num unico ponto — o exception filter — e e por isso
 * que o mapeamento pode ser auditado num arquivo so.
 *
 * O `code` e o que o cliente le para distinguir classes de falha (REQ-19.2). Os
 * valores estao no catalogo da secao 4.6 do design.
 */
export abstract class DomainError extends Error {
  abstract readonly code: string;

  protected constructor(message: string) {
    super(message);
    // Sem isto, `error.name` seria sempre 'Error' e a stack sairia rotulada
    // errado — a subclasse e o que interessa em log de producao.
    this.name = new.target.name;
    Error.captureStackTrace?.(this, new.target);
  }
}
