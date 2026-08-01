import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { ErrorResponseDto } from '../../shared/filters/error-response.dto';
import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { Employee } from './domain/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeeListResponseDto } from './dto/employee-list-response.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService, ListaPaginadaDeColaboradores } from './employees.service';

@ApiTags('employees')
@Controller('employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Post()
  @ApiOperation({ summary: 'Cadastra colaborador (REQ-01.1)' })
  @ApiResponse({ status: HttpStatus.CREATED, type: Employee })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, type: ErrorResponseDto })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    type: ErrorResponseDto,
    description: 'E-mail já pertence a colaborador ativo (REQ-01.3).',
  })
  create(@Body() dto: CreateEmployeeDto): Promise<Employee> {
    return this.service.create(dto);
  }

  @Get()
  @ApiOperation({ summary: 'Lista colaboradores ativos, paginado (REQ-01.6, REQ-11)' })
  @ApiResponse({ status: HttpStatus.OK, type: EmployeeListResponseDto })
  findAll(@Query() pagination: PaginationQueryDto): Promise<ListaPaginadaDeColaboradores> {
    return this.service.findAll(pagination);
  }

  @Get(':id')
  @ApiOperation({ summary: 'Consulta colaborador por id (REQ-01.4)' })
  @ApiResponse({ status: HttpStatus.OK, type: Employee })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorResponseDto })
  findOne(@Param('id') id: string): Promise<Employee> {
    return this.service.findById(id);
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Atualiza dados de colaborador ativo (REQ-01.5)' })
  @ApiResponse({ status: HttpStatus.OK, type: Employee })
  @ApiResponse({ status: HttpStatus.BAD_REQUEST, type: ErrorResponseDto })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorResponseDto })
  @ApiResponse({
    status: HttpStatus.CONFLICT,
    type: ErrorResponseDto,
    description: 'E-mail já pertence a outro colaborador ativo.',
  })
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto): Promise<Employee> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Remove colaborador com propagação aos vínculos (REQ-12)' })
  @ApiResponse({ status: HttpStatus.NO_CONTENT })
  @ApiResponse({ status: HttpStatus.NOT_FOUND, type: ErrorResponseDto })
  softDelete(@Param('id') id: string): Promise<void> {
    return this.service.softDelete(id);
  }
}
