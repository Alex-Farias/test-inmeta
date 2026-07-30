import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { Employee } from './domain/employee.entity';

export interface DadosDeColaborador {
  name: string;
  email: string;
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
}
