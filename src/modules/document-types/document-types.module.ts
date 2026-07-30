import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { DocumentType } from './domain/document-type.entity';
import { DocumentTypesController } from './document-types.controller';
import { DocumentTypesRepository } from './document-types.repository';
import { DocumentTypesService } from './document-types.service';

/** So o service sai nos `exports` — repositorio nao vaza entre modulos (D-10). */
@Module({
  imports: [TypeOrmModule.forFeature([DocumentType])],
  controllers: [DocumentTypesController],
  providers: [DocumentTypesService, DocumentTypesRepository],
  exports: [DocumentTypesService],
})
export class DocumentTypesModule {}
