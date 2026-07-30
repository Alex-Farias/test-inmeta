import { Injectable } from '@nestjs/common';

import { DuplicatedResourceError, EntityNotFoundError } from '../../shared/errors';
import type { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { Employee } from './domain/employee.entity';
import { CreateEmployeeDto } from './dto/create-employee.dto';
import { UpdateEmployeeDto } from './dto/update-employee.dto';
import { EmployeesRepository } from './employees.repository';

export interface ListaPaginadaDeColaboradores {
  items: Employee[];
  total: number;
  page: number;
  limit: number;
}

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

  async findAll(pagination: PaginationQueryDto): Promise<ListaPaginadaDeColaboradores> {
    const { items, total } = await this.repository.findAllActive(pagination);
    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string): Promise<Employee> {
    const colaborador = await this.repository.findActiveById(id);
    if (!colaborador) {
      throw new EntityNotFoundError('Colaborador nao encontrado.');
    }

    return colaborador;
  }

  /**
   * REQ-01.5 nao fala explicitamente de e-mail no update, mas a invariante de
   * REQ-01.3 (unico entre ativos) vale a qualquer momento, nao so na criacao
   * — decisao confirmada com o humano. Reaproveita `findActiveByEmail` da
   * TASK-013, excluindo o proprio colaborador da comparacao.
   */
  async update(id: string, dto: UpdateEmployeeDto): Promise<Employee> {
    const colaborador = await this.findById(id);

    if (dto.email !== undefined && dto.email !== colaborador.email) {
      const emUsoPorOutro = await this.repository.findActiveByEmail(dto.email);
      if (emUsoPorOutro && emUsoPorOutro.id !== id) {
        throw new DuplicatedResourceError('Ja existe um colaborador ativo com este e-mail.');
      }
      colaborador.email = dto.email;
    }

    if (dto.name !== undefined) {
      colaborador.name = dto.name;
    }

    return this.repository.save(colaborador);
  }

  /**
   * Nome espelha o do repositorio (`softDelete`, nao `remove`): o lint
   * (`no-restricted-syntax`, TASK-063) barra qualquer `.remove(`/`.softRemove(`
   * por nome de propriedade, sem distinguir dominio de ORM.
   *
   * Reaproveita `findById` para o not-found (REQ-12.6): colaborador ja
   * removido ou inexistente lanca `EntityNotFoundError` antes de qualquer
   * escrita. Linha unica, sem invariante entre registros nesta task — a
   * propagacao aos vinculos (D-04, operacao critica) so nasce em TASK-032.
   */
  async softDelete(id: string): Promise<void> {
    const colaborador = await this.findById(id);
    await this.repository.softDelete(colaborador.id);
  }
}
