import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { DocumentType } from './domain/document-type.entity';

export interface DadosDeTipoDeDocumento {
  name: string;
  description?: string;
}

@Injectable()
export class DocumentTypesRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** `manager` opcional (D-05) — usado pelo transacional quando fornecido. */
  private repo(manager?: EntityManager): Repository<DocumentType> {
    return (manager ?? this.dataSource.manager).getRepository(DocumentType);
  }

  create(dados: DadosDeTipoDeDocumento, manager?: EntityManager): Promise<DocumentType> {
    const repo = this.repo(manager);
    return repo.save(repo.create(dados));
  }

  /**
   * Consulta simples sobre o alias principal: o filtro automatico do
   * `@DeleteDateColumn` ja basta aqui, sem join (D-06).
   */
  findActiveByName(name: string, manager?: EntityManager): Promise<DocumentType | null> {
    return this.repo(manager).findOneBy({ name });
  }
}
