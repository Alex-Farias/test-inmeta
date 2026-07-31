import { Injectable } from '@nestjs/common';

import { ConcurrentSubmissionError, EntityNotFoundError } from '../../shared/errors';
import { DocumentSubmission } from './domain/document-submission.entity';
import { EmployeeDocumentsRepository } from './employee-documents.repository';
import { SubmissionsRepository } from './submissions.repository';

/** `SQLSTATE` de violacao de unicidade no Postgres. */
const UNIQUE_VIOLATION = '23505';

function ehViolacaoDeUnicidade(erro: unknown): boolean {
  return typeof erro === 'object' && erro !== null && 'code' in erro
    ? (erro as { code?: unknown }).code === UNIQUE_VIOLATION
    : false;
}

@Injectable()
export class SubmissionsService {
  constructor(
    private readonly repository: SubmissionsRepository,
    private readonly employeeDocumentsRepository: EmployeeDocumentsRepository,
  ) {}

  /**
   * Primeiro envio de um vinculo (REQ-06.1). Sem `TransactionRunner`: e uma
   * insercao unica, e a garantia de "no maximo um ativo" vive em
   * `uq_submission_active` desde a migration (D-02), nao em orquestracao de
   * aplicacao. O reenvio (TASK-040) e que traz duas escritas a coordenar, e e
   * la que a transacao entra.
   *
   * Acessa `EmployeeDocumentsRepository` diretamente por ser o **mesmo modulo**
   * e o mesmo agregado (D-10 restringe acesso a repositorio *alheio*).
   *
   * REQ-06.2 — "passa o vinculo ao estado entregue" — nao tem escrita
   * correspondente, e isso e a decisao D-03: pendencia e derivada, lida das
   * submissions a cada consulta. Nao ha coluna de estado que possa divergir.
   */
  async enviar(employeeDocumentId: string): Promise<DocumentSubmission> {
    const vinculo = await this.employeeDocumentsRepository.findActiveById(employeeDocumentId);
    if (!vinculo) {
      throw new EntityNotFoundError('Vinculo nao encontrado.');
    }

    const version = await this.repository.findNextVersion(vinculo.id);

    try {
      return await this.repository.create(vinculo.id, version);
    } catch (erro) {
      // Dois primeiros envios simultaneos para o mesmo vinculo: o perdedor
      // viola `uq_submission_active` e receberia 500 cru sem esta traducao.
      // A discriminacao por nome de constraint (D-14) chega na TASK-041 e
      // estende este ponto, em vez de introduzi-lo do zero.
      if (ehViolacaoDeUnicidade(erro)) {
        throw new ConcurrentSubmissionError();
      }
      throw erro;
    }
  }
}
