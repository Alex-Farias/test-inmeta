import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

const LIMITE_PADRAO = 20;
const LIMITE_TETO = 100;

/**
 * `page`/`limit` por offset (D-15). Exceder o teto **nao** e invalido: o
 * valor e limitado silenciosamente (REQ-11.4). Ja `page`/`limit` nao
 * numerico, zero ou negativo e invalido e cai no ValidationPipe global
 * (REQ-11.6). Ausencia de parametro aplica o padrao documentado (REQ-11.3).
 */
export class PaginationQueryDto {
  @IsOptional()
  @IsInt()
  @Min(1)
  page: number = 1;

  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const numero = Number(value);
    return Number.isFinite(numero) ? Math.min(numero, LIMITE_TETO) : numero;
  })
  @IsInt()
  @Min(1)
  limit: number = LIMITE_PADRAO;
}
