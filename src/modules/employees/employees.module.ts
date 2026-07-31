import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmployeeDocumentsModule } from '../employee-documents/employee-documents.module';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { Employee } from './domain/employee.entity';
import { EmployeesController } from './employees.controller';
import { EmployeesRepository } from './employees.repository';
import { EmployeesService } from './employees.service';

/**
 * So o service sai nos `exports` — repositorio nao vaza entre modulos (D-10).
 *
 * `forwardRef` porque o ciclo entre os dois modulos e real e deliberado:
 * `employee-documents` consome `EmployeesService` para validar o colaborador
 * na vinculacao (REQ-03.4), e `employees` consome `EmployeeDocumentsService`
 * para propagar a remocao aos vinculos (REQ-12.2). Cada um chama o service
 * publico do outro; nenhum alcanca repositorio alheio, que e a regra que D-10
 * de fato estabelece.
 */
@Module({
  imports: [TypeOrmModule.forFeature([Employee]), forwardRef(() => EmployeeDocumentsModule)],
  controllers: [EmployeesController],
  providers: [EmployeesService, EmployeesRepository, TransactionRunner],
  exports: [EmployeesService],
})
export class EmployeesModule {}
