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

import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { Employee } from './domain/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesService, ListaPaginadaDeColaboradores } from './employees.service';

@Controller('employees')
export class EmployeesController {
  constructor(private readonly service: EmployeesService) {}

  @Post()
  create(@Body() dto: CreateEmployeeDto): Promise<Employee> {
    return this.service.create(dto);
  }

  @Get()
  findAll(@Query() pagination: PaginationQueryDto): Promise<ListaPaginadaDeColaboradores> {
    return this.service.findAll(pagination);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Employee> {
    return this.service.findById(id);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() dto: UpdateEmployeeDto): Promise<Employee> {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @HttpCode(HttpStatus.NO_CONTENT)
  softDelete(@Param('id') id: string): Promise<void> {
    return this.service.softDelete(id);
  }
}
