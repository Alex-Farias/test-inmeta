import { ApiProperty } from '@nestjs/swagger';

class ReferenciaNomeada {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

/**
 * Só para documentação (REQ-22.2) — o retorno real do controller é
 * `UltimoEnvio[]` (`statistics.repository.ts`), que fica `interface` porque
 * nada além do Swagger precisa dela como classe.
 */
export class LatestSubmissionResponseDto {
  @ApiProperty({ type: ReferenciaNomeada })
  employee!: ReferenciaNomeada;

  @ApiProperty({ type: ReferenciaNomeada })
  documentType!: ReferenciaNomeada;

  @ApiProperty({ description: 'Inclui versão superada por reenvio (REQ-18.5).' })
  version!: number;

  @ApiProperty()
  submittedAt!: Date;
}
