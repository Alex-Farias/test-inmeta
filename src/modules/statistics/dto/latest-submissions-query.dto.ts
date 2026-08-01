import { Transform } from 'class-transformer';
import { IsInt, IsOptional, Min } from 'class-validator';

import { LIMITE_PADRAO, LIMITE_TETO } from '../../../shared/pagination/pagination-query.dto';

/**
 * Mesma semântica de `PaginationQueryDto` (clamp no teto, rejeição fora do
 * range pelo `ValidationPipe` global) e os mesmos números de D-15 — decisão
 * confirmada com o humano para não introduzir um segundo par de limites no
 * sistema. Só `limit`, sem `page`: "últimos envios" é top-N, não listagem
 * paginada (não há `page`/`total` que fizesse sentido aqui).
 */
export class LatestSubmissionsQueryDto {
  @IsOptional()
  @Transform(({ value }: { value: unknown }) => {
    const numero = Number(value);
    return Number.isFinite(numero) ? Math.min(numero, LIMITE_TETO) : numero;
  })
  @IsInt()
  @Min(1)
  limit: number = LIMITE_PADRAO;
}
