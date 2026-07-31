import { Injectable } from '@nestjs/common';

import { ConformidadeGlobal, StatisticsRepository } from './statistics.repository';

@Injectable()
export class StatisticsService {
  constructor(private readonly repository: StatisticsRepository) {}

  overview(): Promise<ConformidadeGlobal> {
    return this.repository.calcularConformidadeGlobal();
  }
}
