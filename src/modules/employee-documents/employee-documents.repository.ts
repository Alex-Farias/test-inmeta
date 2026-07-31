import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';

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
   * Uma unica instrucao para `deleted_at` e `deletion_cause`: o `CHECK
   * ck_employee_documents_deletion_cause` (D-12) amarra as duas colunas, e
   * grava-las em passos separados abriria uma janela em que a linha viola a
   * propria invariante que o `CHECK` existe para impedir. Recebe `cause` em
   * vez de fixar `'MANUAL'` porque a cascata de remocao de tipo (TASK-033)
   * reusa este mesmo metodo com `'TYPE_REMOVED'`.
   */
  async softDelete(id: string, cause: DeletionCause, manager?: EntityManager): Promise<void> {
    await this.repo(manager).update({ id }, { deletedAt: new Date(), deletionCause: cause });
  }
}
