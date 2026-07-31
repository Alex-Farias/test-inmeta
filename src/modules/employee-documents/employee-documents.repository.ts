import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, FindOptionsWhere, In, IsNull, Repository } from 'typeorm';

import { DeletionCause, EmployeeDocument } from './domain/employee-document.entity';

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

  /** `null` tanto para inexistente quanto para removido (D-08, REQ-04.5). */
  findActiveById(id: string, manager?: EntityManager): Promise<EmployeeDocument | null> {
    return this.repo(manager).findOneBy({ id });
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
