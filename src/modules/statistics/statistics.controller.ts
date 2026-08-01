import { Controller, Get, Query } from '@nestjs/common';

import { LatestSubmissionsQueryDto } from './dto/latest-submissions-query.dto';
import { ConformidadeGlobal, TipoPendente, UltimoEnvio } from './statistics.repository';
import { StatisticsService } from './statistics.service';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly service: StatisticsService) {}

  @Get('overview')
  overview(): Promise<ConformidadeGlobal> {
    return this.service.overview();
  }

  @Get('pending-types')
  pendingTypes(): Promise<TipoPendente[]> {
    return this.service.pendingTypes();
  }

  @Get('latest-submissions')
  latestSubmissions(@Query() query: LatestSubmissionsQueryDto): Promise<UltimoEnvio[]> {
    return this.service.latestSubmissions(query);
  }
}
