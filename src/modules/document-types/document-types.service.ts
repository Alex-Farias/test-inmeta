import { forwardRef, Inject, Injectable } from '@nestjs/common';

import { EmployeeDocumentsService } from '../employee-documents/employee-documents.service';
import { DuplicatedResourceError, EntityNotFoundError } from '../../shared/errors';
import type { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { DocumentType } from './domain/document-type.entity';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { DocumentTypesRepository } from './document-types.repository';

export interface ListaPaginadaDeTiposDeDocumento {
  items: DocumentType[];
  total: number;
  page: number;
  limit: number;
}

@Injectable()
export class DocumentTypesService {
  constructor(
    private readonly repository: DocumentTypesRepository,
    private readonly transactionRunner: TransactionRunner,
    // Ciclo deliberado com `employee-documents` — ver a nota em
    // `document-types.module.ts`.
    @Inject(forwardRef(() => EmployeeDocumentsService))
    private readonly employeeDocumentsService: EmployeeDocumentsService,
  ) {}

  /**
   * Checagem em codigo, nao captura de `23505` (REQ-02.3): o cadastro e
   * escrita unica sem invariante entre registros (D-04), entao nao ha
   * transacao a proteger e a checagem previa e suficiente para o criterio.
   */
  async create(dto: CreateDocumentTypeDto): Promise<DocumentType> {
    const existente = await this.repository.findActiveByName(dto.name);
    if (existente) {
      throw new DuplicatedResourceError('Ja existe um tipo de documento ativo com este nome.');
    }

    return this.repository.create({ name: dto.name, description: dto.description });
  }

  async findAll(pagination: PaginationQueryDto): Promise<ListaPaginadaDeTiposDeDocumento> {
    const { items, total } = await this.repository.findAllActive(pagination);
    return { items, total, page: pagination.page, limit: pagination.limit };
  }

  async findById(id: string): Promise<DocumentType> {
    const tipo = await this.repository.findActiveById(id);
    if (!tipo) {
      throw new EntityNotFoundError('Tipo de documento nao encontrado.');
    }

    return tipo;
  }

  /**
   * Nome espelha o do repositorio (`softDelete`, nao `remove`): o lint
   * (`no-restricted-syntax`, TASK-063) barra qualquer `.remove(`/`.softRemove(`
   * por nome de propriedade, sem distinguir dominio de ORM.
   *
   * Reaproveita `findById` para o not-found (REQ-13.1): tipo ja removido ou
   * inexistente lanca `EntityNotFoundError` antes de qualquer escrita — fora
   * da transacao, porque e leitura e nao ha o que desfazer.
   *
   * Operacao critica (D-04.4, REQ-13.4): marcar o tipo e propagar aos vinculos
   * sao duas escritas com invariante entre elas — nao pode sobrar vinculo
   * ativo exigindo tipo removido. Dai correrem sob o mesmo `manager` do
   * `TransactionRunner` (D-05).
   *
   * Quem escreve em `employee_documents` e o modulo dono, via service publico
   * (D-10). Os envios dos vinculos afetados nao sao tocados (REQ-13.5): a
   * cascata para no vinculo, e e o que preserva o historico.
   */
  async softDelete(id: string): Promise<void> {
    const tipo = await this.findById(id);

    await this.transactionRunner.run(async (manager) => {
      await this.repository.softDelete(tipo.id, manager);
      await this.employeeDocumentsService.removerVinculosDoTipo(tipo.id, manager);
    });
  }
}
