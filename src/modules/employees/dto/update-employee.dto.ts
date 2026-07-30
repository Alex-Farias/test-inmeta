import { IsEmail, IsOptional, IsString, MaxLength, MinLength } from 'class-validator';

/** Campos opcionais de `CreateEmployeeDto` — REQ-01.5. */
export class UpdateEmployeeDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(150)
  name?: string;

  @IsOptional()
  @IsEmail()
  @MaxLength(255)
  email?: string;
}
