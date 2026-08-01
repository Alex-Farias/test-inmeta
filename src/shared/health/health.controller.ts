import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';

/**
 * REQ-21.1/21.2. `pingCheck` executa uma consulta real contra o Postgres via o
 * `DataSource` global do TypeOrm — banco fora do ar reprova o check em vez de
 * responder sucesso fixo (diferencial declarado em stack.md).
 */
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
