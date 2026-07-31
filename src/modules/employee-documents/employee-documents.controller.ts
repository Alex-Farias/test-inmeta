import { Body, Controller, Delete, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';

import { EmployeeDocument } from './domain/employee-document.entity';
import { CreateEmployeeDocumentsDto } from './dto/create-employee-documents.dto';
import { EmployeeDocumentsService } from './employee-documents.service';

@Controller('employee-documents')
export class EmployeeDocumentsController {
  constructor(private readonly service: EmployeeDocumentsService) {}

  @Post()
  vincular(@Body() dto: CreateEmployeeDocumentsDto): Promise<EmployeeDocument[]> {
    return this.service.vincular(dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  desvincular(@Param('id') id: string): Promise<void> {
    return this.service.desvincular(id);
  }
}
