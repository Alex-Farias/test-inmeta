import { ApiProperty } from '@nestjs/swagger';

class ReferenciaDeTipo {
  @ApiProperty({ format: 'uuid' })
  id!: string;

  @ApiProperty()
  name!: string;
}

/**
 * Só para documentação (REQ-22.2) — o retorno real do controller é
 * `TipoPendente[]` (`statistics.repository.ts`), que fica `interface`
 * porque nada além do Swagger precisa dela como classe.
 */
export class PendingTypeResponseDto {
  @ApiProperty({ type: ReferenciaDeTipo })
  documentType!: ReferenciaDeTipo;

  @ApiProperty()
  pendingCount!: number;
}
