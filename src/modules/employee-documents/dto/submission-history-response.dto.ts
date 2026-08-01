import { ApiProperty } from '@nestjs/swagger';

import { DocumentSubmission } from '../domain/document-submission.entity';

/**
 * Só para documentação (REQ-22.2) — o retorno real do controller é
 * `HistoricoDeEnvios` (`submissions.service.ts`), que fica `interface`
 * porque nada além do Swagger precisa dela como classe.
 */
export class SubmissionHistoryResponseDto {
  @ApiProperty({ type: [DocumentSubmission] })
  items!: DocumentSubmission[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  limit!: number;
}
