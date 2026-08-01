import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Espelha as colunas de `employees` (design.md §1.3) — REQ-01.2. */
export class CreateEmployeeDto {
  @ApiProperty({ maxLength: 150, example: 'Ana Souza' })
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @ApiProperty({ maxLength: 255, format: 'email', example: 'ana.souza@empresa.com' })
  @IsEmail()
  @MaxLength(255)
  email!: string;
}
