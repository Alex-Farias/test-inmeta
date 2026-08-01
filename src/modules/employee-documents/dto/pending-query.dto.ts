import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsUUID } from 'class-validator';

import { PaginationQueryDto } from '../../../shared/pagination/pagination-query.dto';

/**
 * Query de `GET /employee-documents/pending` (design.md §4.3) — REQ-10.2, REQ-10.3.
 * Os dois filtros sao opcionais e cumulativos (REQ-10.4); precisam estar
 * declarados aqui porque o `ValidationPipe` global usa `whitelist` +
 * `forbidNonWhitelisted` (REQ-19.6/19.7) e rejeitaria campo nao mapeado.
 */
export class PendingQueryDto extends PaginationQueryDto {
  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  employeeId?: string;

  @ApiPropertyOptional({ format: 'uuid' })
  @IsOptional()
  @IsUUID('4')
  documentTypeId?: string;
}
