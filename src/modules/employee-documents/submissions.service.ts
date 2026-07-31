import { Injectable } from '@nestjs/common';

import { EntityNotFoundError, traduzirViolacaoDeUnicidade } from '../../shared/errors';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { DocumentSubmission } from './domain/document-submission.entity';
import { EmployeeDocumentsRepository } from './employee-documents.repository';
import { SubmissionsRepository } from './submissions.repository';

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
    // `findSubmittableById`, e nao `findActiveById`: alem do proprio vinculo, ele
    // exige colaborador e tipo ativos. Os tres casos saem como o mesmo 404 —
    // vinculo inexistente ou removido (REQ-06.4), colaborador removido
    // (REQ-06.5) e tipo removido (REQ-14.8). Nao ha valor em distinguir qual elo
    // caiu: para quem chama, o vinculo nao esta la para receber envio, e detalhar
    // o motivo revelaria a existencia de registro removido a quem nao deveria
    // ve-lo.
    const vinculo = await this.employeeDocumentsRepository.findSubmittableById(employeeDocumentId);
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
      // Traduz aqui, e nao so no filter, para preservar o contrato de
      // `DomainError` para **qualquer** chamador — inclusive os testes de
      // integracao, que chamam o service direto e nunca passam por HTTP. A
      // tabela e a mesma dos dois lados (D-14); o filter e rede, nao
      // substituto.
      //
      // `null` significa que nao e `23505`: repropaga o original intacto, para
      // nao mascarar queda de conexao como conflito.
      const traduzido = traduzirViolacaoDeUnicidade(erro);
      throw traduzido ?? erro;
    }
  }
}
