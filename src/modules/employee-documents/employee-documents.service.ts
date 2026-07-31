import { Injectable } from '@nestjs/common';

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
    private readonly employeesService: EmployeesService,
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
}
