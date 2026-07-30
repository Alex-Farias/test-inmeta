import { Body, Controller, Get, Post, Query } from '@nestjs/common';

import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { Employee } from './domain/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
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
}
