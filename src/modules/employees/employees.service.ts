import { Injectable } from '@nestjs/common';

import { DuplicatedResourceError } from '../../shared/errors';
import { Employee } from './domain/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { EmployeesRepository } from './employees.repository';

@Injectable()
export class EmployeesService {
  constructor(private readonly repository: EmployeesRepository) {}

  /**
   * Checagem em codigo, nao captura de `23505` (REQ-01.3): o cadastro e
   * escrita unica sem invariante entre registros (D-04), entao nao ha
   * transacao a proteger e a checagem previa e suficiente para o criterio.
   */
  async create(dto: CreateEmployeeDto): Promise<Employee> {
    const existente = await this.repository.findActiveByEmail(dto.email);
    if (existente) {
      throw new DuplicatedResourceError('Ja existe um colaborador ativo com este e-mail.');
    }

    return this.repository.create({ name: dto.name, email: dto.email });
  }
}
