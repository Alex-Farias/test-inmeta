import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * Espelha `CorpoDeErro` (`domain-exception.filter.ts`) só para documentação
 * (REQ-22.3) — não é o que o filter usa em runtime, é a mesma forma descrita
 * para o Swagger. Formato único qualquer que seja a origem da falha
 * (REQ-19.1); catálogo completo de `error` em D-08/design.md §4.6.
 */
export class ErrorResponseDto {
  @ApiProperty({ example: 404 })
  statusCode!: number;

  @ApiProperty({
    description:
      'Catálogo (design.md §4.6): NOT_FOUND (404) · VALIDATION_ERROR (400) · ' +
      'BUSINESS_RULE_VIOLATION (422) · DUPLICATED_RESOURCE (409) · ' +
      'CONCURRENT_SUBMISSION (409, corrida legítima — repetir resolve) · ' +
      'VERSION_CONFLICT (409, defeito de cálculo de versão — repetir não resolve) · ' +
      'INTERNAL_ERROR (500, sem detalhe interno vazado).',
    example: 'NOT_FOUND',
  })
  error!: string;

  @ApiProperty({ example: 'Recurso nao encontrado.' })
  message!: string;

  @ApiPropertyOptional({
    description: 'Só presente em VALIDATION_ERROR, um item por campo recusado.',
  })
  details?: unknown;

  @ApiProperty({ format: 'uuid', description: 'Mesmo id do cabeçalho X-Request-Id (REQ-19.3).' })
  requestId!: string;

  @ApiProperty({ format: 'date-time' })
  timestamp!: string;
}
