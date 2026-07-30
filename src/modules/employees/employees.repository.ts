import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import type { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { Employee } from './domain/employee.entity';

export interface DadosDeColaborador {
  name: string;
  email: string;
}

export interface PaginaDeColaboradores {
  items: Employee[];
  total: number;
}

@Injectable()
export class EmployeesRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** `manager` opcional (D-05) — usado pelo transacional quando fornecido. */
  private repo(manager?: EntityManager): Repository<Employee> {
    return (manager ?? this.dataSource.manager).getRepository(Employee);
  }

  create(dados: DadosDeColaborador, manager?: EntityManager): Promise<Employee> {
    const repo = this.repo(manager);
    return repo.save(repo.create(dados));
  }

  /**
   * Consulta simples sobre o alias principal: o filtro automatico do
   * `@DeleteDateColumn` ja basta aqui, sem join (D-06).
   */
  findActiveByEmail(email: string, manager?: EntityManager): Promise<Employee | null> {
    return this.repo(manager).findOneBy({ email });
  }

  /**
   * Ordena por `createdAt` com desempate por `id` (D-15) — garante que
   * paginacao nao repita nem omita item entre paginas.
   */
  async findAllActive(
    pagination: PaginationQueryDto,
    manager?: EntityManager,
  ): Promise<PaginaDeColaboradores> {
    const [items, total] = await this.repo(manager).findAndCount({
      order: { createdAt: 'ASC', id: 'ASC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return { items, total };
  }

  /** `null` tanto para inexistente quanto para removido (D-08, REQ-01.4). */
  findActiveById(id: string, manager?: EntityManager): Promise<Employee | null> {
    return this.repo(manager).findOneBy({ id });
  }

  save(colaborador: Employee, manager?: EntityManager): Promise<Employee> {
    return this.repo(manager).save(colaborador);
  }
}
