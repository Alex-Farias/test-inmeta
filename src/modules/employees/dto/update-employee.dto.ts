import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Campos opcionais de `CreateEmployeeDto` — REQ-01.5. */
export class UpdateEmployeeDto {
  @ApiPropertyOptional({ minLength: 1, maxLength: 150, example: 'Ana Souza' })
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @ApiPropertyOptional({ maxLength: 255, format: 'email', example: 'ana.souza@empresa.com' })
  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}
