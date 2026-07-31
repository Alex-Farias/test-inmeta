import { Injectable } from '@nestjs/common';

import { ConcurrentSubmissionError, EntityNotFoundError } from '../../shared/errors';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
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
    private readonly transactionRunner: TransactionRunner,
  ) {}

  /**
   * Envio e reenvio pelo mesmo metodo: a rota e uma so (D-16), e o primeiro
   * envio e o **caso degenerado** do reenvio — `deactivateActive` afeta zero
   * linhas quando nao ha ativa. Sem branch, sem duas trilhas para uma operacao.
   *
   * Operacao critica (D-04.2, REQ-15.1): desativar a anterior e inserir a nova
   * sao duas escritas com invariante entre elas. O que a transacao compra, e
   * que `uq_submission_active` sozinho nao da: sem ela, um reenvio perdedor
   * teria **commitado a desativacao** antes de a insercao falhar, deixando o
   * vinculo sem envio ativo nenhum. O indice impede dois ativos; so a transacao
   * impede **zero** — que e o que REQ-07.6 exige ao mandar deixar o vinculo no
   * estado em que estava antes da tentativa.
   *
   * O vinculo e resolvido **fora** da transacao: e leitura, e o 404 nao tem o
   * que desfazer.
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

    try {
      return await this.transactionRunner.run(async (manager) => {
        await this.repository.deactivateActive(vinculo.id, manager);

        // `findNextVersion` conta **todas** as submissions do vinculo, nao so a
        // ativa: depois de uma remocao nao ha ativa, mas o historico permanece,
        // e reaproveitar o numero quebraria REQ-08.4 (provado na TASK-047).
        const version = await this.repository.findNextVersion(vinculo.id, manager);

        return this.repository.create(vinculo.id, version, manager);
      });
    } catch (erro) {
      // Envios simultaneos para o mesmo vinculo: o perdedor viola
      // `uq_submission_active` e receberia 500 cru sem esta traducao. A
      // discriminacao por nome de constraint (D-14) chega na TASK-041 e estende
      // este ponto, em vez de introduzi-lo do zero.
      if (ehViolacaoDeUnicidade(erro)) {
        throw new ConcurrentSubmissionError();
      }
      throw erro;
    }
  }
}
