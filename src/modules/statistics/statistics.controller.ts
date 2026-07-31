import { Controller, Get } from '@nestjs/common';

import { ConformidadeGlobal } from './statistics.repository';
import { StatisticsService } from './statistics.service';

@Controller('statistics')
export class StatisticsController {
  constructor(private readonly service: StatisticsService) {}

  @Get('overview')
  overview(): Promise<ConformidadeGlobal> {
    return this.service.overview();
  }
}
