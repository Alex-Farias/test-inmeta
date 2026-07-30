import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { EmployeeDocument } from './domain/employee-document.entity';
import { EmployeeDocumentsController } from './employee-documents.controller';
import { EmployeeDocumentsRepository } from './employee-documents.repository';
import { EmployeeDocumentsService } from './employee-documents.service';

/** So o service sai nos `exports` — repositorio nao vaza entre modulos (D-10). */
@Module({
  imports: [TypeOrmModule.forFeature([EmployeeDocument])],
  controllers: [EmployeeDocumentsController],
  providers: [EmployeeDocumentsService, EmployeeDocumentsRepository, TransactionRunner],
  exports: [EmployeeDocumentsService],
})
export class EmployeeDocumentsModule {}
