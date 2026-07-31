import {
  ArgumentsHost,
  Catch,
  ExceptionFilter,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import type { Request, Response } from 'express';

import { DomainError, ValidationError, traduzirViolacaoDeUnicidade } from '../errors';

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
  VERSION_CONFLICT: HttpStatus.CONFLICT,
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
/** Mensagem fixa do 500. Deliberadamente sem nenhuma informacao do erro real. */
const MENSAGEM_ERRO_INTERNO = 'Erro interno. Consulte o suporte informando o requestId.';

@Catch()
export class DomainExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(DomainExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost): void {
    const contexto = host.switchToHttp();
    const response = contexto.getResponse<Response>();
    const request = contexto.getRequest<Request>();

    // Apenas le. A geracao e do RequestIdMiddleware — ver o comentario la sobre
    // por que ela nao pode morar aqui.
    const requestId = request.requestId ?? '';
    const corpo = this.montarCorpo(exception, requestId);

    if (corpo.error === 'INTERNAL_ERROR') {
      this.registrarFalhaNaoPrevista(exception, requestId);
    }

    response.status(corpo.statusCode).json(corpo);
  }

  /**
   * REQ-19.5: a resposta e generica, mas o rastreamento completo precisa existir
   * em algum lugar. Vai para o log com o mesmo requestId da resposta — e esse
   * par que permite pegar o id que o cliente reportou e achar a stack.
   */
  private registrarFalhaNaoPrevista(exception: unknown, requestId: string): void {
    const stack = exception instanceof Error ? exception.stack : undefined;
    const descricao = exception instanceof Error ? exception.message : String(exception);

    this.logger.error(`Falha nao prevista [requestId=${requestId}]: ${descricao}`, stack);
  }

  private montarCorpo(exception: unknown, requestId: string): CorpoDeErro {
    const timestamp = new Date().toISOString();

    // Rede para `23505` que chegue sem traducao previa (D-14). Vale para
    // employees, document-types e qualquer modulo futuro: nenhum deles precisa
    // de `catch` proprio, porque a mesma tabela do service de submissions cobre
    // por aqui — o default dela e `DuplicatedResourceError`.
    //
    // Roda **antes** do ramo de DomainError, e nao depois, porque o resultado e
    // um DomainError e precisa seguir exatamente o mesmo caminho: mesmo status,
    // mesmo formato, e sem passar pelo registro de falha nao prevista.
    const erro =
      exception instanceof DomainError ? exception : traduzirViolacaoDeUnicidade(exception);

    if (erro instanceof DomainError) {
      return {
        statusCode: STATUS_POR_CODIGO[erro.code] ?? HttpStatus.INTERNAL_SERVER_ERROR,
        error: erro.code,
        message: erro.message,
        // Sexta chave, so em VALIDATION_ERROR (D-08). A ausencia e a norma.
        ...(erro instanceof ValidationError && erro.details.length > 0
          ? { details: erro.details }
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

    // Falha nao prevista. A resposta NAO carrega a mensagem do erro original
    // (REQ-19.4): erro de driver traz nome de tabela e trecho da consulta, e
    // repassa-lo seria vazar o schema para quem provocou a falha.
    return {
      statusCode: HttpStatus.INTERNAL_SERVER_ERROR,
      error: 'INTERNAL_ERROR',
      message: MENSAGEM_ERRO_INTERNO,
      requestId,
      timestamp,
    };
  }
}
