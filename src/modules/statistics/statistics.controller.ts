import { Controller, Get, Query } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { LatestSubmissionResponseDto } from './dto/latest-submission-response.dto';
import { LatestSubmissionsQueryDto } from './dto/latest-submissions-query.dto';
import { OverviewResponseDto } from './dto/overview-response.dto';
import { PendingTypeResponseDto } from './dto/pending-type-response.dto';
import { ConformidadeGlobal, TipoPendente, UltimoEnvio } from './statistics.repository';
import { StatisticsService } from './statistics.service';

@ApiTags('statistics')
@Controller('statistics')
export class StatisticsController {
  constructor(private readonly service: StatisticsService) {}

  @Get('overview')
  @ApiOperation({ summary: 'Conformidade global de colaboradores e documentos (REQ-16)' })
  @ApiResponse({ status: 200, type: OverviewResponseDto })
  overview(): Promise<ConformidadeGlobal> {
    return this.service.overview();
  }

  @Get('pending-types')
  @ApiOperation({ summary: 'Tipos mais pendentes, ranking completo sem paginação (REQ-17)' })
  @ApiResponse({ status: 200, type: [PendingTypeResponseDto] })
  pendingTypes(): Promise<TipoPendente[]> {
    return this.service.pendingTypes();
  }

  @Get('latest-submissions')
  @ApiOperation({ summary: 'Últimos envios, ativos e superados, top-N (REQ-18)' })
  @ApiResponse({ status: 200, type: [LatestSubmissionResponseDto] })
  latestSubmissions(@Query() query: LatestSubmissionsQueryDto): Promise<UltimoEnvio[]> {
    return this.service.latestSubmissions(query);
  }
}
