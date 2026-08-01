import { ApiProperty } from '@nestjs/swagger';

/**
 * Referência nomeada, não a entidade inteira — mesma forma que
 * `VinculoPendente` já declara localmente em `employee-documents.repository.ts`
 * (D-06/§2.1: sem `@ManyToOne` nem import de entidade de outro módulo).
 */
class ReferenciaNomeada {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

/**
 * Só para documentação (REQ-22.2) — o retorno real do controller é
 * `ListaPaginadaDePendentes` (`employee-documents.service.ts`), que fica
 * `interface` porque nada além do Swagger precisa dela como classe.
 */
export class PendingItemDto {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty({ type: ReferenciaNomeada })
  employee!: ReferenciaNomeada;

  @ApiProperty({ type: ReferenciaNomeada })
  documentType!: ReferenciaNomeada;
}

export class PendingListResponseDto {
  @ApiProperty({ type: [PendingItemDto] })
  items!: PendingItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
