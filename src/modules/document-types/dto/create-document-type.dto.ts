import { IsNotEmpty, IsOptional, IsString, MaxLength } from 'class-validator';

/** Espelha as colunas de `document_types` (design.md §1.3) — REQ-02.2. */
export class CreateDocumentTypeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(100)
  name!: string;

  @IsOptional()
  @IsString()
  description?: string;
}
