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
import { EmployeeDocument } from './domain/employee-document.entity';
import { CreateEmployeeDocumentsDto } from './dto/create-employee-documents.dto';
import { EmployeeDocumentsService, ListaPaginadaDePendentes } from './employee-documents.service';

@Controller('employee-documents')
export class EmployeeDocumentsController {
  constructor(private readonly service: EmployeeDocumentsService) {}

  @Post()
  vincular(@Body() dto: CreateEmployeeDocumentsDto): Promise<EmployeeDocument[]> {
    return this.service.vincular(dto);
  }

  @Get('pending')
  listarPendentes(@Query() pagination: PaginationQueryDto): Promise<ListaPaginadaDePendentes> {
    return this.service.listarPendentes(pagination);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  desvincular(@Param('id') id: string): Promise<void> {
    return this.service.desvincular(id);
  }
}
