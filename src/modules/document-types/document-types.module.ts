import { forwardRef, Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { EmployeeDocumentsModule } from '../employee-documents/employee-documents.module';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { DocumentType } from './domain/document-type.entity';
import { DocumentTypesController } from './document-types.controller';
import { DocumentTypesRepository } from './document-types.repository';
import { DocumentTypesService } from './document-types.service';

/**
 * So o service sai nos `exports` — repositorio nao vaza entre modulos (D-10).
 *
 * `forwardRef` pelo mesmo motivo de `employees.module.ts`: o consumo e mutuo.
 * `employee-documents` chama `DocumentTypesService` para validar o tipo na
 * vinculacao (REQ-03.3), e este modulo chama de volta para propagar a remocao
 * aos vinculos (REQ-13.2). Nenhum dos dois alcanca repositorio alheio, que e o
 * que D-10 de fato proibe.
 */
@Module({
  imports: [TypeOrmModule.forFeature([DocumentType]), forwardRef(() => EmployeeDocumentsModule)],
  controllers: [DocumentTypesController],
  providers: [DocumentTypesService, DocumentTypesRepository, TransactionRunner],
  exports: [DocumentTypesService],
})
export class DocumentTypesModule {}
