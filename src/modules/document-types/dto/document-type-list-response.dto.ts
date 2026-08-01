import { ApiProperty } from '@nestjs/swagger';

import { DocumentType } from '../domain/document-type.entity';

/**
 * Só para documentação (REQ-22.2) — o retorno real do controller é
 * `ListaPaginadaDeTiposDeDocumento` (`document-types.service.ts`), que fica
 * `interface` porque nada além do Swagger precisa dela como classe.
 */
export class DocumentTypeListResponseDto {
  @ApiProperty({ type: [DocumentType] })
  items!: DocumentType[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
