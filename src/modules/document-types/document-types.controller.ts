import { Body, Controller, Post } from '@nestjs/common';

import { DocumentType } from './domain/document-type.entity';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { DocumentTypesService } from './document-types.service';

@Controller('document-types')
export class DocumentTypesController {
  constructor(private readonly service: DocumentTypesService) {}

  @Post()
  create(@Body() dto: CreateDocumentTypeDto): Promise<DocumentType> {
    return this.service.create(dto);
  }
}
