import { Injectable } from '@nestjs/common';

import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { EmployeeDocument } from './domain/employee-document.entity';
import { CreateEmployeeDocumentsDto } from './dto/create-employee-documents.dto';
import { EmployeeDocumentsRepository } from './employee-documents.repository';

@Injectable()
export class EmployeeDocumentsService {
  constructor(
    private readonly repository: EmployeeDocumentsRepository,
    private readonly transactionRunner: TransactionRunner,
  ) {}

  /**
   * Vinculação em lote é operação crítica (D-04, REQ-15.1): N inserções na
   * mesma tabela com invariante entre elas (todas ou nenhuma), daí passar
   * pelo `TransactionRunner` mesmo sem cruzar módulo.
   */
  vincular(dto: CreateEmployeeDocumentsDto): Promise<EmployeeDocument[]> {
    return this.transactionRunner.run((manager) =>
      this.repository.createMany(dto.employeeId, dto.documentTypeIds, manager),
    );
  }
}
