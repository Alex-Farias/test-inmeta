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
import { EmployeeDocument } from './domain/employee-document.entity';
import { CreateEmployeeDocumentsDto } from './dto/create-employee-documents.dto';
import { PendingListResponseDto } from './dto/pending-list-response.dto';
import { PendingQueryDto } from './dto/pending-query.dto';
import { EmployeeDocumentsService, ListaPaginadaDePendentes } from './employee-documents.service';

@ApiTags('employee-documents')
@Controller('employee-documents')
export class EmployeeDocumentsController {
  constructor(private readonly service: EmployeeDocumentsService) {}

  @Post()
  @ApiOperation({ summary: 'Vincula colaborador a um ou mais tipos, em lote (REQ-03)' })
  @ApiResponse({ status: HttpStatus.CREATED, type: [EmployeeDocument] })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, type: ErrorResponseDto })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    type: ErrorResponseDto,
    description: 'Colaborador ou algum tipo removido/inexistente (REQ-03.3).',
  })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    type: ErrorResponseDto,
    description: 'Vínculo ativo já existente para algum par (REQ-03.4).',
  })
  vincular(@Body() dto: CreateEmployeeDocumentsDto): Promise<EmployeeDocument[]> {
    return this.service.vincular(dto);
  }

  @Get('pending')
  @ApiOperation({ summary: 'Lista vínculos pendentes, com filtros e paginação (REQ-10, REQ-11)' })
  @ApiResponse({ status: HttpStatus.OK, type: PendingListResponseDto })
  listarPendentes(@Query() query: PendingQueryDto): Promise<ListaPaginadaDePendentes> {
    return this.service.listarPendentes(query);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Desvincula, com causa MANUAL (REQ-04)' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorResponseDto })
  desvincular(@Param('id') id: string): Promise<void> {
    return this.service.desvincular(id);
  }
}
