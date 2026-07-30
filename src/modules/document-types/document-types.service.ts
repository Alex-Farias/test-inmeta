import { Injectable } from '@nestjs/common';

import { DuplicatedResourceError } from '../../shared/errors';
import { DocumentType } from './domain/document-type.entity';
import { CreateDocumentTypeDto } from './dto/create-document-type.dto';
import { DocumentTypesRepository } from './document-types.repository';

@Injectable()
export class DocumentTypesService {
  constructor(private readonly repository: DocumentTypesRepository) {}

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
}
