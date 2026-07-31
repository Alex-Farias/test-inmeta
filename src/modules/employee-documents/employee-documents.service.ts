import { forwardRef, Inject, Injectable } from '@nestjs/common';
import type { EntityManager } from 'typeorm';

import { DocumentTypesService } from '../document-types/document-types.service';
import { EmployeesService } from '../employees/employees.service';
import { DuplicatedResourceError, EntityNotFoundError } from '../../shared/errors';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { EmployeeDocument } from './domain/employee-document.entity';
import { CreateEmployeeDocumentsDto } from './dto/create-employee-documents.dto';
import { EmployeeDocumentsRepository } from './employee-documents.repository';

@Injectable()
export class EmployeeDocumentsService {
  constructor(
    private readonly repository: EmployeeDocumentsRepository,
    private readonly transactionRunner: TransactionRunner,
    // Ciclo deliberado com `employees` — ver a nota em `employees.module.ts`.
    @Inject(forwardRef(() => EmployeesService))
    private readonly employeesService: EmployeesService,
    // Ciclo deliberado com `document-types` — ver a nota no module dele.
    @Inject(forwardRef(() => DocumentTypesService))
    private readonly documentTypesService: DocumentTypesService,
  ) {}

  /**
   * Vinculação em lote é operação crítica (D-04, REQ-15.1): N inserções na
   * mesma tabela com invariante entre elas (todas ou nenhuma), daí passar
   * pelo `TransactionRunner` mesmo sem cruzar módulo.
   *
   * As validações (REQ-03.3/03.4/03.5) rodam antes de abrir a transação: são
   * leituras, e reaproveitam `findById` de `EmployeesService`/
   * `DocumentTypesService` (D-10 — nunca repositório alheio), que já lançam
   * `EntityNotFoundError` para removido ou inexistente.
   */
  async vincular(dto: CreateEmployeeDocumentsDto): Promise<EmployeeDocument[]> {
    await this.employeesService.findById(dto.employeeId);
    await Promise.all(dto.documentTypeIds.map((id) => this.documentTypesService.findById(id)));

    const duplicados = await this.repository.findActiveDocumentTypeIds(
      dto.employeeId,
      dto.documentTypeIds,
    );
    if (duplicados.length > 0) {
      throw new DuplicatedResourceError(
        'Colaborador ja possui vinculo ativo com um dos tipos de documento informados.',
      );
    }

    return this.transactionRunner.run((manager) =>
      this.repository.createMany(dto.employeeId, dto.documentTypeIds, manager),
    );
  }

  /**
   * Desvinculação é não crítica (D-04): escrita de linha única, e o `CHECK`
   * de D-12 garante a invariante entre `deleted_at`/`deletion_cause` por DDL
   * — sem `TransactionRunner` aqui, ao contrário de `vincular`.
   */
  async desvincular(id: string): Promise<void> {
    const vinculo = await this.repository.findActiveById(id);
    if (!vinculo) {
      throw new EntityNotFoundError('Vinculo nao encontrado.');
    }

    await this.repository.softDelete(vinculo.id, 'MANUAL');
  }

  /**
   * Ponto de entrada publico da propagacao de REQ-12.2: quem remove o
   * colaborador e `employees`, mas quem escreve em `employee_documents` e este
   * modulo (D-10). O `manager` chega de fora porque a remocao do colaborador e
   * a dos vinculos precisam ser atomicas (D-04.3, D-05) — a transacao e aberta
   * pelo chamador, nao aqui.
   *
   * Causa `'EMPLOYEE_REMOVED'`, simetrica a `'TYPE_REMOVED'` da cascata de
   * tipo: D-12 distingue cada gatilho de remocao para manter a restauracao
   * seletiva possivel.
   */
  async removerVinculosDoColaborador(employeeId: string, manager?: EntityManager): Promise<void> {
    await this.repository.softDeleteAllByEmployeeId(employeeId, 'EMPLOYEE_REMOVED', manager);
  }

  /**
   * Espelho do anterior para REQ-13.2, com a causa `'TYPE_REMOVED'` que
   * REQ-13.3 exige para distinguir a cascata do desvinculo manual de REQ-04.
   *
   * Mesma divisao de D-10: `document-types` remove o tipo e abre a transacao,
   * este modulo escreve em `employee_documents`. O `manager` chega de fora
   * porque as duas escritas precisam ser atomicas (D-04.4, D-05).
   */
  async removerVinculosDoTipo(documentTypeId: string, manager?: EntityManager): Promise<void> {
    await this.repository.softDeleteAllByDocumentTypeId(documentTypeId, 'TYPE_REMOVED', manager);
  }
}
