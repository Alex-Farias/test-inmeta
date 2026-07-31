import { Controller, Get, HttpCode, HttpStatus, Param, Post, Query } from '@nestjs/common';

import { PaginationQueryDto } from '../../shared/pagination/pagination-query.dto';
import { DocumentSubmission } from './domain/document-submission.entity';
import { HistoricoDeEnvios, SubmissionsService } from './submissions.service';

/**
 * Aninhado sob o vinculo que possui a submission (D-16): nao existe rota
 * `/submissions` de primeiro nivel, para que nao haja caminho que crie envio
 * sem passar pelo agregado.
 *
 * `POST` sem corpo — upload e armazenamento de arquivo estao fora de escopo, e
 * o enunciado pede a representacao logica do envio.
 */
@Controller('employee-documents/:employeeDocumentId/submissions')
export class SubmissionsController {
  constructor(private readonly service: SubmissionsService) {}

  @Post()
  @HttpCode(HttpStatus.CREATED)
  enviar(@Param('employeeDocumentId') employeeDocumentId: string): Promise<DocumentSubmission> {
    return this.service.enviar(employeeDocumentId);
  }

  /**
   * A **unica** rota do sistema que responde sobre registro removido (REQ-09.4,
   * REQ-09.5, REQ-14.6). Mesmo caminho do `POST` de proposito: o historico
   * pertence ao vinculo tanto quanto o envio (D-16), e separa-lo numa rota
   * propria sugeriria que sao recursos diferentes.
   */
  @Get()
  consultarHistorico(
    @Param('employeeDocumentId') employeeDocumentId: string,
    @Query() pagination: PaginationQueryDto,
  ): Promise<HistoricoDeEnvios> {
    return this.service.consultarHistorico(employeeDocumentId, pagination);
  }
}
