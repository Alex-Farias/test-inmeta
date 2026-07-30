import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import type { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { DocumentType } from './domain/document-type.entity';

export interface DadosDeTipoDeDocumento {
  name: string;
  description?: string;
}

export interface PaginaDeTiposDeDocumento {
  items: DocumentType[];
  total: number;
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

  /**
   * Ordena por `createdAt` com desempate por `id` (D-15) — garante que
   * paginacao nao repita nem omita item entre paginas.
   */
  async findAllActive(
    pagination: PaginationQueryDto,
    manager?: EntityManager,
  ): Promise<PaginaDeTiposDeDocumento> {
    const [items, total] = await this.repo(manager).findAndCount({
      order: { createdAt: 'ASC', id: 'ASC' },
      skip: (pagination.page - 1) * pagination.limit,
      take: pagination.limit,
    });

    return { items, total };
  }

  /** `null` tanto para inexistente quanto para removido (D-08, REQ-02.5). */
  findActiveById(id: string, manager?: EntityManager): Promise<DocumentType | null> {
    return this.repo(manager).findOneBy({ id });
  }

  /**
   * `softDelete` por criteria (UPDATE), nunca `.remove()`/`.softRemove()`
   * (proibidos pelo lint, TASK-063). Nao verifica estado previo — a checagem
   * de "ja removido" fica no service, via `findActiveById` (REQ-13.1).
   */
  async softDelete(id: string, manager?: EntityManager): Promise<void> {
    await this.repo(manager).softDelete({ id });
  }
}
