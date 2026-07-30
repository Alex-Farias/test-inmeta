import { Body, Controller, Post } from '@nestjs/common';

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
}
