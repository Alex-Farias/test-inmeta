import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
} from '@nestjs/common';

import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { DocumentType } from './domain/document-type.entity';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { DocumentTypesService, ListaPaginadaDeTiposDeDocumento } from './document-types.service';

@Controller('document-types')
export class DocumentTypesController {
  constructor(private readonly service: DocumentTypesService) {}

  @Post()
  create(@Body() dto: CreateDocumentTypeDto): Promise<DocumentType> {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() pagination: PaginationQueryDto): Promise<ListaPaginadaDeTiposDeDocumento> {
    return this.service.findAll(pagination);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<DocumentType> {
    return this.service.findById(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  softDelete(@Param('id') id: string): Promise<void> {
    return this.service.softDelete(id);
  }
}
