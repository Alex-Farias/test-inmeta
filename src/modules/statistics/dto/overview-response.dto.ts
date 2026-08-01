import { ApiProperty } from '@nestjs/swagger';

/**
 * Só para documentação (REQ-22.2) — o retorno real do controller é
 * `ConformidadeGlobal` (`statistics.repository.ts`), que fica `interface`
 * porque nada além do Swagger precisa dela como classe.
 */
export class OverviewResponseDto {
  @ApiProperty({ description: 'REQ-16.6: 0 quando não há base para o cálculo.' })
  employeesFullyCompliantPercentage!: number;

  @ApiProperty({ description: 'REQ-16.6: 0 quando não há base para o cálculo.' })
  documentsSubmittedPercentage!: number;

  @ApiProperty({
    description: 'Colaboradores ativos sem nenhum vínculo ativo — fora do denominador (REQ-16.4).',
  })
  employeesWithoutRequirements!: number;
}
