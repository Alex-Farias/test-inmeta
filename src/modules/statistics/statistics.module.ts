import { Module } from '@nestjs/common';

import { StatisticsController } from './statistics.controller';
import { StatisticsRepository } from './statistics.repository';
import { StatisticsService } from './statistics.service';

/**
 * Sem `TypeOrmModule.forFeature`: `StatisticsRepository` acessa o schema por
 * SQL direto (D-10), não por entidade própria. Sem `exports`: nenhum outro
 * módulo consome `statistics` — é a exceção read-only do design, não um
 * serviço de domínio reaproveitável.
 */
@Module({
  controllers: [StatisticsController],
  providers: [StatisticsService, StatisticsRepository],
})
export class StatisticsModule {}
