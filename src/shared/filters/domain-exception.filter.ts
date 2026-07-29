import { ArgumentsHost, Catch, ExceptionFilter, HttpException, HttpStatus } from '@nestjs/common';
import type { Request, Response } from 'express';

import { DomainError, ValidationError } from '../errors';

/**
 * O unico lugar do sistema que sabe traduzir falha em status HTTP (D-08).
 *
 * A tabela vive aqui, e nao nas classes de erro, porque foi decidido que os
 * erros de dominio sao agnosticos de protocolo. O ganho pratico e este arquivo:
 * o mapeamento inteiro cabe numa tela e pode ser conferido de uma vez.
 */
const STATUS_POR_CODIGO: Readonly<Record<string, HttpStatus>> = {
  NOT_FOUND: HttpStatus.NOT_FOUND,
  VALIDATION_ERROR: HttpStatus.BAD_REQUEST,
  BUSINESS_RULE_VIOLATION: HttpStatus.UNPROCESSABLE_ENTITY,
  DUPLICATED_RESOURCE: HttpStatus.CONFLICT,
  CONCURRENT_SUBMISSION: HttpStatus.CONFLICT,
};

export interface CorpoDeErro {
  statusCode: number;
  error: string;
  message: string;
  details?: unknown;
  requestId: string;
  timestamp: string;
}

/**
 * `@Catch()` sem argumento e proposital. REQ-19.1 exige formato unico "qualquer
 * que seja a origem da falha" — um filter que so pegasse DomainError deixaria
 * HttpException do proprio Nest respondendo noutro formato, e a promessa de
 * estabilidade valeria so para os erros que nos escrevemos.
 */
@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  catch(exception: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const response = contexto.getResponse<Response>();
    const request = contexto.getRequest<Request>();

    // Apenas le. A geracao e do RequestIdMiddleware — ver o comentario la sobre
    // por que ela nao pode morar aqui.
    const corpo = this.montarCorpo(exception, request.requestId ?? '');

    response.status(corpo.statusCode).json(corpo);
  }

  private montarCorpo(exception: unknown, requestId: string): CorpoDeErro {
    const timestamp = new Date().toISOString();

    if (exception instanceof DomainError) {
      return {
        statusCode: STATUS_POR_CODIGO[exception.code] ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error: exception.code,
        message: exception.message,
        // Sexta chave, so em VALIDATION_ERROR (D-08). A ausencia e a norma.
        ...(exception instanceof ValidationError && exception.details.length > 0
          ? { details: exception.details }
          : {}),
        requestId,
        timestamp,
      };
    }

    if (exception instanceof HttpException) {
      // Falha que o proprio Nest produz — rota inexistente, metodo nao
      // permitido. Preserva o status que ele decidiu e apenas reveste no nosso
      // formato, para nao haver duas formas de erro na mesma API.
      return {
        statusCode: exception.getStatus(),
        error: HttpStatus[exception.getStatus()] ?? 'HTTP_ERROR',
        message: exception.message,
        requestId,
        timestamp,
      };
    }

    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_ERROR',
      message: 'Erro interno.',
      requestId,
      timestamp,
    };
  }
}
