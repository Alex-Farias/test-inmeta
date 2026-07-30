import { IsEmail, IsNotEmpty, IsString, MaxLength } from 'class-validator';

/** Espelha as colunas de `employees` (design.md §1.3) — REQ-01.2. */
export class CreateEmployeeDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(150)
  name!: string;

  @IsEmail()
  @MaxLength(255)
  email!: string;
}
