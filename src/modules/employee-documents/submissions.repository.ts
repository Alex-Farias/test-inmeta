import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, IsNull, Repository } from 'typeorm';

import type { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { DocumentSubmission } from './domain/document-submission.entity';

export interface PaginaDeEnvios {
  items: DocumentSubmission[];
  total: number;
}

@Injectable()
export class SubmissionsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** `manager` opcional (D-05) — usado pelo transacional quando fornecido. */
  private repo(manager?: EntityManager): Repository<DocumentSubmission> {
    return (manager ?? this.dataSource.manager).getRepository(DocumentSubmission);
  }

  /**
   * **Um dos dois pontos do sistema que ignoram o filtro de soft delete de
   * proposito** — o outro e `findHistory`, logo abaixo, e os motivos sao
   * diferentes: aqui e para nao reemitir numero de versao, la e porque o
   * historico e a excecao declarada a REQ-14.2.
   *
   * Por 1.3 do design a proxima versao e `COALESCE(MAX(version), 0) + 1` sobre
   * **todas** as submissions do vinculo, inclusive as removidas. Filtrar
   * removidas aqui reemitiria um numero ja usado, e `uq_submission_version` —
   * que nao e parcial justamente por isso — rejeitaria a insercao. REQ-08.4
   * exige que o contador nao reinicie.
   *
   * O `.withDeleted()` nao e vazamento: e o requisito. Qualquer autorrevisao
   * que o encontre deve parar neste comentario antes de "corrigi-lo".
   */
  async findNextVersion(employeeDocumentId: string, manager?: EntityManager): Promise<number> {
    const resultado = await this.repo(manager)
      .createQueryBuilder('submission')
      .withDeleted()
      .select('COALESCE(MAX(submission.version), 0) + 1', 'proxima')
      .where('submission.employee_document_id = :employeeDocumentId', { employeeDocumentId })
      .getRawOne<{ proxima: string }>();

    // `MAX` sobre integer volta como string no driver do Postgres.
    return Number(resultado?.proxima ?? 1);
  }

  /**
   * Desativa o envio ativo do vinculo, se houver. O predicado e **o mesmo** de
   * `uq_submission_active` de proposito: o que o indice considera ativo e o que
   * esta desativacao alcanca precisam ser a mesma coisa, senao o reenvio
   * tentaria inserir sobre uma linha que ele acredita ter desativado.
   *
   * `deleted_at IS NULL` explicito porque `update()` nao recebe o filtro
   * automatico do `@DeleteDateColumn` (D-06) — mesma licao das cascatas de
   * remocao em `employee-documents.repository.ts`.
   *
   * Afeta zero linhas quando nao ha envio ativo, e e o que dispensa um branch
   * para o primeiro envio: ele e o caso degenerado do reenvio.
   */
  async deactivateActive(employeeDocumentId: string, manager?: EntityManager): Promise<void> {
    await this.repo(manager).update(
      { employeeDocumentId, isActive: true, deletedAt: IsNull() },
      { isActive: false },
    );
  }

  /**
   * Remove o envio ativo do vinculo (REQ-08.1, REQ-08.2, D-13).
   *
   * **As duas colunas no mesmo `UPDATE`.** D-13 manda marcar `deleted_at` **e**
   * `is_active = false`, e 4.3 do design le as duas juntas: `false` + data
   * significa "o proprio envio foi removido", e `true` + data e declarado estado
   * invalido. Gravar em dois passos abriria exatamente essa janela. Para o
   * indice parcial `uq_submission_active` a segunda coluna e redundante — mas o
   * historico e lido por gente, e uma linha removida que ainda se declara ativa
   * mente sobre REQ-08.3.
   *
   * **Nao reativa versao anterior**, e nao ha o que fazer para isso: a ausencia
   * de escrita e a decisao. O vinculo volta a ser **lido** como pendente porque
   * o `NOT EXISTS` de 1.4 pergunta por envio ativo, nao por existencia de envio
   * (D-03). Nenhuma consulta trata esse estado como caso especial.
   *
   * Mesmo predicado de `deactivateActive` e de `uq_submission_active`, pela
   * mesma razao comentada la. `deleted_at IS NULL` explicito porque `update()`
   * nao recebe o filtro automatico do `@DeleteDateColumn` (D-06) — e e ele que
   * faz a segunda remocao afetar zero linhas em vez de reescrever `deleted_at`.
   *
   * Devolve se alcancou alguma linha: zero linhas e envio ja removido ou vinculo
   * que nunca teve envio, e o service traduz nos dois casos em 404 (REQ-08.6).
   */
  async softDeleteActive(employeeDocumentId: string, manager?: EntityManager): Promise<boolean> {
    const resultado = await this.repo(manager).update(
      { employeeDocumentId, isActive: true, deletedAt: IsNull() },
      { isActive: false, deletedAt: new Date() },
    );

    return (resultado.affected ?? 0) > 0;
  }

  /**
   * Historico completo do vinculo (REQ-09.1, REQ-09.2, REQ-09.3).
   *
   * `withDeleted()` e o requisito, nao vazamento. REQ-14.2 manda excluir
   * removidos de toda listagem "**exceto onde o historico for explicitamente
   * solicitado**", e esta e a excecao — a unica do sistema (design 4.3). Omitir
   * o envio removido deixaria um buraco inexplicado na sequencia de versoes,
   * porque REQ-08.4 proibe reaproveitar o numero: o historico ficaria mentindo
   * por omissao, que e exatamente o que REQ-08 diz querer evitar.
   *
   * Ordena por `version DESC` — mais recente primeiro, como o exemplo de 4.3.
   * Dispensa o desempate por `id` que D-15 exige das outras listagens:
   * `uq_submission_version` torna `version` unica por vinculo, entao ela ja e
   * ordenacao total. Nao ha dois envios do mesmo vinculo que possam trocar de
   * posicao entre paginas.
   *
   * Sem join: o criterio e a coluna `employee_document_id` da propria tabela.
   * Filtrar por vinculo ou colaborador removido aqui seria **contrariar**
   * REQ-09.4 e REQ-09.5.
   */
  async findHistory(
    employeeDocumentId: string,
    pagination: PaginationQueryDto,
    manager?: EntityManager,
  ): Promise<PaginaDeEnvios> {
    const [items, total] = await this.repo(manager).findAndCount({
      where: { employeeDocumentId },
      withDeleted: true,
      order: { version: 'DESC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return { items, total };
  }

  create(
    employeeDocumentId: string,
    version: number,
    manager?: EntityManager,
  ): Promise<DocumentSubmission> {
    const repo = this.repo(manager);
    return repo.save(
      repo.create({
        employeeDocumentId,
        version,
        isActive: true,
        submittedAt: new Date(),
      }),
    );
  }
}
