import { ApiPropertyOptional, ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Espelha as colunas de `document_types` (design.md §1.3) — REQ-02.2. */
export class CreateDocumentTypeDto {
  @ApiProperty({ maxLength: 100, example: 'CPF' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @ApiPropertyOptional({ example: 'Cadastro de Pessoa Física' })
  @IsOptional()
  @IsString()
  description?: string;
}
