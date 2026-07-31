import { Injectable } from '@nestjs/common';

import { EntityNotFoundError, traduzirViolacaoDeUnicidade } from '../../shared/errors';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import type { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { DocumentSubmission } from './domain/document-submission.entity';
import { EmployeeDocumentsRepository } from './employee-documents.repository';
import { SubmissionsRepository } from './submissions.repository';

export interface HistoricoDeEnvios {
  items: DocumentSubmission[];
  total: number;
  page: number;
  limit: number;
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

  /**
   * Remocao do envio ativo (REQ-08).
   *
   * **Nao critica (D-04).** E um `UPDATE` de linha unica em
   * `document_submissions`: a atomicidade vem do proprio statement, e abrir
   * transacao aqui seria cerimonia sem garantia adicional. Esta entre as quatro
   * operacoes que a tabela de D-04 classifica explicitamente como nao criticas
   * — a discriminacao e o que o enunciado pede demonstrar, e trata-la como
   * critica por uniformidade apagaria a distincao.
   *
   * **`findSubmittableById`, o mesmo de `enviar`.** Remover envio e caminho de
   * **escrita**, e D-06 e explicito de que a regra do JOIN vale igual dos dois
   * lados; REQ-14.8 manda responder nao encontrado para escrita solicitada sobre
   * registro removido. Vinculo, colaborador ou tipo removido saem todos como o
   * mesmo 404, sem revelar qual elo caiu.
   *
   * O contraste com `consultarHistorico`, logo abaixo, e deliberado e vale o
   * paragrafo: **ler** o historico de um vinculo removido responde 200, e e a
   * unica excecao declarada a REQ-14.2. **Escrever** nele responde 404.
   *
   * As duas consultas produzem o mesmo 404 por motivos diferentes, e os dois
   * estao em REQ-08.6: o vinculo nao esta la para receber a operacao, ou nao ha
   * envio ativo — porque ja foi removido, ou porque nunca houve. Distinguir
   * exigiria uma segunda consulta so para detalhar um estado que o chamador nao
   * pode agir de forma diferente.
   */
  async removerEnvioAtivo(employeeDocumentId: string): Promise<void> {
    const vinculo = await this.employeeDocumentsRepository.findSubmittableById(employeeDocumentId);
    if (!vinculo) {
      throw new EntityNotFoundError('Vinculo nao encontrado.');
    }

    const removido = await this.repository.softDeleteActive(vinculo.id);
    if (!removido) {
      throw new EntityNotFoundError('Envio ativo nao encontrado.');
    }
  }

  /**
   * Historico completo do vinculo (REQ-09).
   *
   * **Nao resolve o vinculo antes de consultar**, ao contrario de `enviar`. E
   * deliberado: esta e a excecao declarada a REQ-14.2 (design 4.3), e o
   * historico responde mesmo com vinculo, colaborador ou tipo removidos —
   * `findSubmittableById` recusaria exatamente os casos que REQ-09.4 e REQ-09.5
   * exigem atender.
   *
   * Mas resolve o vinculo por `findAnyById`, que enxerga removidos, e isso e o
   * que separa **removido** de **nunca existiu**. Sem ele a alternativa seria
   * responder 200 com pagina vazia para um uuid digitado errado, afirmando que o
   * vinculo existe e nao tem envios — o 404 e a resposta honesta.
   *
   * Tres casos, um metodo: removido devolve 200 com o historico completo, ativo
   * devolve 200 com o historico completo, inexistente devolve 404.
   */
  async consultarHistorico(
    employeeDocumentId: string,
    pagination: PaginationQueryDto,
  ): Promise<HistoricoDeEnvios> {
    const vinculo = await this.employeeDocumentsRepository.findAnyById(employeeDocumentId);
    if (!vinculo) {
      throw new EntityNotFoundError('Vinculo nao encontrado.');
    }

    const { items, total } = await this.repository.findHistory(employeeDocumentId, pagination);

    return { items, total, page: pagination.page, limit: pagination.limit };
  }
}
