import { Controller, HttpCode, HttpStatus, Param, Post } from '@nestjs/common';

import { DocumentSubmission } from './domain/document-submission.entity';
import { SubmissionsService } from './submissions.service';

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
}
