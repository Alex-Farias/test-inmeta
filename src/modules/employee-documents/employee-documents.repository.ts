import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, IsNull, Repository } from 'typeorm';

import type { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { DeletionCause, EmployeeDocument } from './domain/employee-document.entity';

export interface VinculoPendente {
  id: string;
  employee: { id: string; name: string };
  documentType: { id: string; name: string };
}

export interface PaginaDePendentes {
  items: VinculoPendente[];
  total: number;
}

interface LinhaDePendente {
  vinculo_id: string;
  colaborador_id: string;
  colaborador_name: string;
  tipo_id: string;
  tipo_name: string;
}

@Injectable()
export class EmployeeDocumentsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** `manager` opcional (D-05) — usado pelo transacional quando fornecido. */
  private repo(manager?: EntityManager): Repository<EmployeeDocument> {
    return (manager ?? this.dataSource.manager).getRepository(EmployeeDocument);
  }

  createMany(
    employeeId: string,
    documentTypeIds: string[],
    manager?: EntityManager,
  ): Promise<EmployeeDocument[]> {
    const repo = this.repo(manager);
    const vinculos = documentTypeIds.map((documentTypeId) =>
      repo.create({ employeeId, documentTypeId }),
    );
    return repo.save(vinculos);
  }

  /**
   * Sem join manual: criterio simples sobre o alias principal, entao o filtro
   * automatico do `@DeleteDateColumn` ja basta (D-06) — nao repete `deleted_at
   * IS NULL`. Usado para REQ-03.5 (vinculo ativo ja existente).
   */
  async findActiveDocumentTypeIds(
    employeeId: string,
    documentTypeIds: string[],
    manager?: EntityManager,
  ): Promise<string[]> {
    const vinculos = await this.repo(manager).find({
      where: { employeeId, documentTypeId: In(documentTypeIds) },
    });
    return vinculos.map((vinculo) => vinculo.documentTypeId);
  }

  /**
   * ── Os tres `find...ById`, e o que separa um do outro ──────────────────────
   *
   * Sao tres de proposito, com visibilidades diferentes de `deleted_at`. Antes
   * de escrever um quarto, confira se um destes ja serve:
   *
   * | Metodo                | Enxerga                                  | Serve   |
   * |-----------------------|------------------------------------------|---------|
   * | `findActiveById`      | vinculo ativo                            | REQ-04.5|
   * | `findSubmittableById` | + colaborador e tipo ativos, via JOIN    | REQ-06.5|
   * | `findAnyById`         | qualquer vinculo que ja existiu          | REQ-09.4|
   *
   * A ordem e de rigor decrescente. `findSubmittableById` e o mais restritivo
   * porque escrever exige cadeia ativa (D-06); `findAnyById` e o mais permissivo
   * porque o historico e a excecao declarada a REQ-14.2 e precisa responder
   * sobre registro removido. Trocar um pelo outro nao da erro de compilacao e
   * quebra um requisito em silencio — dai a tabela.
   * ───────────────────────────────────────────────────────────────────────────
   */

  /** `null` tanto para inexistente quanto para removido (D-08, REQ-04.5). */
  findActiveById(id: string, manager?: EntityManager): Promise<EmployeeDocument | null> {
    return this.repo(manager).findOneBy({ id });
  }

  /**
   * Vinculo que **ja existiu**, ativo ou removido (REQ-09.4, REQ-14.6).
   *
   * `withDeleted` desliga o filtro do `@DeleteDateColumn`, e aqui isso e o
   * requisito: o historico responde sobre vinculo removido, e usar
   * `findActiveById` daria 404 exatamente nos casos que REQ-09.4 manda atender.
   *
   * O que ele **nao** faz e apagar a distincao entre removido e inexistente.
   * Vinculo removido devolve a linha, e o historico sai; id que nunca existiu
   * devolve `null`, e o service traduz em 404. Sem esta consulta o unico caminho
   * seria responder 200 com pagina vazia para uuid digitado errado, afirmando
   * que o vinculo existe e nao tem envios.
   */
  findAnyById(id: string, manager?: EntityManager): Promise<EmployeeDocument | null> {
    return this.repo(manager).findOne({ where: { id }, withDeleted: true });
  }

  /**
   * Vinculo apto a receber envio: ele proprio ativo, **e** de colaborador ativo,
   * **e** de tipo de documento ativo. `null` em qualquer um dos casos, para que
   * o service devolva 404 sem distinguir qual elo caiu (REQ-06.4, REQ-06.5,
   * REQ-14.8).
   *
   * **Existe separado de `findActiveById` por causa dos dois JOINs.** O filtro
   * automatico do `@DeleteDateColumn` cobre apenas o alias principal (D-06):
   * `findActiveById` enxerga `employee_documents.deleted_at` e mais nada. Um
   * vinculo cujo colaborador foi removido, mas que ainda nao foi marcado, passa
   * por ele — e REQ-06.5 exige rejeitar exatamente esse caso.
   *
   * **Por que nao confiar na cascata.** Hoje remover um colaborador propaga a
   * remocao aos vinculos, entao na pratica o vinculo ja viria marcado. D-06 e
   * explicito sobre nao aceitar isso como garantia: a propagacao e defesa em
   * profundidade, e a garantia primaria e o JOIN. Depender da cascata seria
   * depender de duas escritas terem acontecido na ordem certa para que uma
   * leitura responda direito.
   *
   * **JOIN por nome de tabela, nao por entidade**, e por `innerJoin` e nao
   * `innerJoinAndSelect`: o vinculo entre modulos e por coluna uuid simples, sem
   * `@ManyToOne` (ver o comentario em `employee-document.entity.ts`). Importar
   * `Employee` e `DocumentType` aqui contradiria 2.1 do design; o join fica no
   * nivel do SQL, que e onde ele de fato mora.
   *
   * Cada `ON` repete `AND <alias>.deleted_at IS NULL`. E o item do checklist que
   * mais falha, e este e o primeiro JOIN manual em codigo de producao do
   * projeto.
   */
  findSubmittableById(id: string, manager?: EntityManager): Promise<EmployeeDocument | null> {
    return this.repo(manager)
      .createQueryBuilder('vinculo')
      .innerJoin(
        'employees',
        'colaborador',
        'colaborador.id = vinculo.employee_id AND colaborador.deleted_at IS NULL',
      )
      .innerJoin(
        'document_types',
        'tipo',
        'tipo.id = vinculo.document_type_id AND tipo.deleted_at IS NULL',
      )
      .where('vinculo.id = :id', { id })
      .getOne();
  }

  /**
   * Pendencia derivada (D-03, design §1.4): vinculo ativo, de colaborador ativo
   * e tipo ativo, sem submission ativa. Traducao literal do SQL do design —
   * `NOT EXISTS` contra `document_submissions`, servido por `uq_submission_active`
   * sem indice adicional.
   *
   * Sem `vinculo.deleted_at IS NULL` explicito: o alias principal ja recebe o
   * filtro automatico do `@DeleteDateColumn` (D-06). Os dois `innerJoin`, por
   * nome de tabela como em `findSubmittableById`, repetem o filtro manualmente
   * porque join manual e exatamente o que o filtro automatico nao alcanca —
   * aqui e onde REQ-14.3/14.4 vazariam se um dos dois sumisse.
   *
   * Contagem via `.clone()` da mesma query, mesmos JOINs e mesmo `WHERE`: D-15
   * exige que o total repita os filtros de remocao da consulta principal, e
   * nao uma contagem simples de `employee_documents`.
   *
   * Ordena por `created_at` com desempate por `id` (D-15), mesma convencao de
   * `EmployeesRepository.findAllActive`.
   */
  async findPending(
    pagination: PaginationQueryDto,
    manager?: EntityManager,
  ): Promise<PaginaDePendentes> {
    const base = this.repo(manager)
      .createQueryBuilder('vinculo')
      .innerJoin(
        'employees',
        'colaborador',
        'colaborador.id = vinculo.employee_id AND colaborador.deleted_at IS NULL',
      )
      .innerJoin(
        'document_types',
        'tipo',
        'tipo.id = vinculo.document_type_id AND tipo.deleted_at IS NULL',
      )
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM document_submissions s
          WHERE s.employee_document_id = vinculo.id
            AND s.is_active
            AND s.deleted_at IS NULL
        )`,
      );

    const total = await base.clone().getCount();

    const linhas = await base
      .clone()
      .select([
        'vinculo.id AS vinculo_id',
        'colaborador.id AS colaborador_id',
        'colaborador.name AS colaborador_name',
        'tipo.id AS tipo_id',
        'tipo.name AS tipo_name',
      ])
      .orderBy('vinculo.created_at', 'ASC')
      .addOrderBy('vinculo.id', 'ASC')
      .offset((pagination.page - 1) * pagination.limit)
      .limit(pagination.limit)
      .getRawMany<LinhaDePendente>();

    const items = linhas.map((linha) => ({
      id: linha.vinculo_id,
      employee: { id: linha.colaborador_id, name: linha.colaborador_name },
      documentType: { id: linha.tipo_id, name: linha.tipo_name },
    }));

    return { items, total };
  }

  /**
   * Uma unica instrucao para `deleted_at` e `deletion_cause`: o `CHECK
   * ck_employee_documents_deletion_cause` (D-12) amarra as duas colunas, e
   * grava-las em passos separados abriria uma janela em que a linha viola a
   * propria invariante que o `CHECK` existe para impedir.
   *
   * Remocao de linha unica, so para o desvinculo manual (REQ-04). As cascatas
   * nao passam por aqui: um `UPDATE` por vinculo seria N idas ao banco onde um
   * `WHERE` resolve — ver `softDeleteAllByParent`.
   */
  async softDelete(id: string, cause: DeletionCause, manager?: EntityManager): Promise<void> {
    await this.repo(manager).update({ id }, { deletedAt: new Date(), deletionCause: cause });
  }

  /**
   * Corpo comum das duas cascatas. Existe para que o `deletedAt: IsNull()`
   * viva em um ponto so: `update()` nao recebe o filtro automatico do
   * `@DeleteDateColumn` (D-06 — ele cobre leitura pelo alias principal, nao
   * escrita), e sem ele a cascata reescreveria `deleted_at`/`deletion_cause`
   * de um vinculo ja desvinculado como `'MANUAL'`, destruindo justamente a
   * distincao que D-12 existe para preservar. E a guarda que se perderia se um
   * terceiro gatilho copiasse um dos metodos publicos sem revisar.
   *
   * `cause` como uniao literal, nao `string`: fecha no compilador o que o
   * `CHECK ck_employee_documents_deletion_cause` fecha no banco — nenhum quarto
   * valor entra por nenhum dos dois lados sem decisao explicita.
   *
   * Um unico `UPDATE` para N linhas: agregacao em SQL, sem carregar a colecao
   * para iterar no Node.
   */
  private async softDeleteAllByParent(
    criteria: FindOptionsWhere<EmployeeDocument>,
    cause: DeletionCause,
    manager?: EntityManager,
  ): Promise<void> {
    await this.repo(manager).update(
      { ...criteria, deletedAt: IsNull() },
      { deletedAt: new Date(), deletionCause: cause },
    );
  }

  /** Cascata de remocao de colaborador (REQ-12.2). */
  softDeleteAllByEmployeeId(
    employeeId: string,
    cause: DeletionCause,
    manager?: EntityManager,
  ): Promise<void> {
    return this.softDeleteAllByParent({ employeeId }, cause, manager);
  }

  /** Cascata de remocao de tipo de documento (REQ-13.2). */
  softDeleteAllByDocumentTypeId(
    documentTypeId: string,
    cause: DeletionCause,
    manager?: EntityManager,
  ): Promise<void> {
    return this.softDeleteAllByParent({ documentTypeId }, cause, manager);
  }
}
