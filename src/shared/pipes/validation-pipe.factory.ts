import { ValidationPipe } from '@nestjs/common';
import type { ValidationError as ClassValidatorError } from 'class-validator';

import { ValidationError, type ValidationDetail } from '../errors';

/**
 * Achata a arvore de erros do class-validator no formato de `details` de D-08:
 * lista, com caminho por ponto para campo aninhado.
 *
 * O class-validator devolve `children` recursivo — `endereco` contendo `cep`.
 * Sem achatar, o cliente teria que percorrer arvore para descobrir qual campo
 * caiu, que e exatamente o trabalho que REQ-19.6 quer poupar dele.
 */
export function achatarErrosDeValidacao(
  erros: ClassValidatorError[],
  prefixo = '',
): ValidationDetail[] {
  return erros.flatMap((erro) => {
    const caminho = prefixo ? `${prefixo}.${erro.property}` : erro.property;
    const reasons = Object.values(erro.constraints ?? {});

    const proprio: ValidationDetail[] = reasons.length > 0 ? [{ field: caminho, reasons }] : [];
    const filhos = erro.children?.length ? achatarErrosDeValidacao(erro.children, caminho) : [];

    return [...proprio, ...filhos];
  });
}

/**
 * O ValidationPipe global (REQ-19.6, REQ-19.7).
 *
 * `forbidNonWhitelisted` e o que atende REQ-19.7: sem ele, `whitelist` apenas
 * removeria o campo desconhecido em silencio — e silencio e precisamente o que
 * o requisito proibe. Quem enviou `nomeCompleto` em vez de `nome` precisa
 * descobrir isso, e nao ver um 201 que ignorou metade do payload.
 *
 * O `exceptionFactory` converte para o nosso ValidationError em vez de deixar
 * o Nest lancar BadRequestException com formato proprio. Sem isso, REQ-19.1
 * — formato unico qualquer que seja a origem — teria excecao logo na borda,
 * que e onde o cliente mais topa com erro.
 */
export function criarValidationPipe(): ValidationPipe {
  return new ValidationPipe({
    whitelist: true,
    forbidNonWhitelisted: true,
    transform: true,
    transformOptions: { enableImplicitConversion: true },
    exceptionFactory: (erros: ClassValidatorError[]) =>
      new ValidationError('Entrada invalida.', achatarErrosDeValidacao(erros)),
  });
}
