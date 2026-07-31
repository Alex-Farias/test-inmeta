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

import { EmployeeDocument } from './domain/employee-document.entity';
import { CreateEmployeeDocumentsDto } from './dto/create-employee-documents.dto';
import { PendingQueryDto } from './dto/pending-query.dto';
import { EmployeeDocumentsService, ListaPaginadaDePendentes } from './employee-documents.service';

@Controller('employee-documents')
export class EmployeeDocumentsController {
  constructor(private readonly service: EmployeeDocumentsService) {}

  @Post()
  vincular(@Body() dto: CreateEmployeeDocumentsDto): Promise<EmployeeDocument[]> {
    return this.service.vincular(dto);
  }

  @Get('pending')
  listarPendentes(@Query() query: PendingQueryDto): Promise<ListaPaginadaDePendentes> {
    return this.service.listarPendentes(query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  desvincular(@Param('id') id: string): Promise<void> {
    return this.service.desvincular(id);
  }
}
