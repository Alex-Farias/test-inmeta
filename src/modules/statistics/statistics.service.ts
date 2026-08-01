import { Injectable } from '@nestjs/common';

import { LatestSubmissionsQueryDto } from './dto/latest-submissions-query.dto';
import {
  ConformidadeGlobal,
  StatisticsRepository,
  TipoPendente,
  UltimoEnvio,
} from './statistics.repository';

@Injectable()
export class StatisticsService {
  constructor(private readonly repository: StatisticsRepository) {}

  overview(): Promise<ConformidadeGlobal> {
    return this.repository.calcularConformidadeGlobal();
  }

  pendingTypes(): Promise<TipoPendente[]> {
    return this.repository.rankingDeTiposPendentes();
  }

  latestSubmissions(query: LatestSubmissionsQueryDto): Promise<UltimoEnvio[]> {
    return this.repository.ultimosEnvios(query.limit);
  }
}
