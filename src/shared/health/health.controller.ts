import { Controller, Get } from '@nestjs/common';
import { HealthCheck, HealthCheckService, TypeOrmHealthIndicator } from '@nestjs/terminus';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

/**
 * REQ-21.1/21.2. `pingCheck` executa uma consulta real contra o Postgres via o
 * `DataSource` global do TypeOrm — banco fora do ar reprova o check em vez de
 * responder sucesso fixo (diferencial declarado em stack.md).
 */
@ApiTags('health')
@Controller('health')
export class HealthController {
  constructor(
    private readonly health: HealthCheckService,
    private readonly db: TypeOrmHealthIndicator,
  ) {}

  @Get()
  @HealthCheck()
  @ApiOperation({
    summary: 'Estado do serviço e da conexão com o banco (REQ-21)',
    description: 'Banco indisponível responde 503 com status "error", não sucesso.',
  })
  check() {
    return this.health.check([() => this.db.pingCheck('database')]);
  }
}
