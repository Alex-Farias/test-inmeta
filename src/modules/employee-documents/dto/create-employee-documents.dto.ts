import { ApiProperty } from '@nestjs/swagger';
import { ArrayNotEmpty, IsArray, IsUUID } from 'class-validator';

/** Corpo de `POST /employee-documents` (design.md §4.3) — REQ-03.1. */
export class CreateEmployeeDocumentsDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  employeeId!: string;

  @ApiProperty({ type: [String], format: 'uuid' })
  @IsArray()
  @ArrayNotEmpty()
  @IsUUID('4', { each: true })
  documentTypeIds!: string[];
}
