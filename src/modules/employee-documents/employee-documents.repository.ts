import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { EmployeeDocument } from './domain/employee-document.entity';

@Injectable()
export class EmployeeDocumentsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** `manager` opcional (D-05) — usado pelo transacional quando fornecido. */
  private repo(manager?: EntityManager): Repository<EmployeeDocument> {
    return (manager ?? this.dataSource.manager).getRepository(EmployeeDocument);
  }

  createMany(
    employeeId: string,
    documentTypeIds: string[],
    manager?: EntityManager,
  ): Promise<EmployeeDocument[]> {
    const repo = this.repo(manager);
    const vinculos = documentTypeIds.map((documentTypeId) =>
      repo.create({ employeeId, documentTypeId }),
    );
    return repo.save(vinculos);
  }
}
