import { ApiProperty } from '@nestjs/swagger';

import { Employee } from '../domain/employee.entity';

/**
 * Só para documentação (REQ-22.2) — o retorno real do controller é
 * `ListaPaginadaDeColaboradores` (`employees.service.ts`), que fica
 * `interface` porque nada além do Swagger precisa dela como classe.
 */
export class EmployeeListResponseDto {
  @ApiProperty({ type: [Employee] })
  items!: Employee[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
