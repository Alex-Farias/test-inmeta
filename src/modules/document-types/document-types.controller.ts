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
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ErrorResponseDto } from '../../shared/filters/error-response.dto';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { DocumentType } from './domain/document-type.entity';
import { DocumentTypeListResponseDto } from './dto/document-type-list-response.dto';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { DocumentTypesService, ListaPaginadaDeTiposDeDocumento } from './document-types.service';

@ApiTags('document-types')
@Controller('document-types')
export class DocumentTypesController {
  constructor(private readonly service: DocumentTypesService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra tipo de documento (REQ-02.1)' })
  @ApiResponse({ status: HttpStatus.CREATED, type: DocumentType })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, type: ErrorResponseDto })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    type: ErrorResponseDto,
    description: 'Nome já pertence a tipo ativo (REQ-02.3).',
  })
  create(@Body() dto: CreateDocumentTypeDto): Promise<DocumentType> {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista tipos ativos, paginado (REQ-02.4, REQ-11)' })
  @ApiResponse({ status: HttpStatus.OK, type: DocumentTypeListResponseDto })
  findAll(@Query() pagination: PaginationQueryDto): Promise<ListaPaginadaDeTiposDeDocumento> {
    return this.service.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta tipo de documento por id (REQ-02.5)' })
  @ApiResponse({ status: HttpStatus.OK, type: DocumentType })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorResponseDto })
  findOne(@Param('id') id: string): Promise<DocumentType> {
    return this.service.findById(id);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove tipo com cascata aos vínculos (REQ-13)' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorResponseDto })
  softDelete(@Param('id') id: string): Promise<void> {
    return this.service.softDelete(id);
  }
}
