import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DocumentTypesModule } from '../document-types/document-types.module';
import { EmployeesModule } from '../employees/employees.module';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { EmployeeDocument } from './domain/employee-document.entity';
import { EmployeeDocumentsController } from './employee-documents.controller';
import { EmployeeDocumentsRepository } from './employee-documents.repository';
import { EmployeeDocumentsService } from './employee-documents.service';

/**
 * Importa `EmployeesModule`/`DocumentTypesModule` para consumir os services
 * publicos deles (REQ-03.3/03.4, D-10) — nunca o repositorio. So o proprio
 * service sai nos `exports` — repositorio nao vaza entre modulos.
 *
 * `forwardRef` em `EmployeesModule`: a partir da TASK-032 o consumo e mutuo —
 * `employees` chama de volta este service para propagar a remocao aos vinculos
 * (REQ-12.2). Ver a nota em `employees.module.ts`.
 */
@Module({
  imports: [
    TypeOrmModule.forFeature([EmployeeDocument]),
    forwardRef(() => EmployeesModule),
    DocumentTypesModule,
  ],
  controllers: [EmployeeDocumentsController],
  providers: [EmployeeDocumentsService, EmployeeDocumentsRepository, TransactionRunner],
  exports: [EmployeeDocumentsService],
})
export class EmployeeDocumentsModule {}
