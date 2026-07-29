import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER } from '@nestjs/core';

import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { DomainExceptionFilter } from './shared/filters/domain-exception.filter';

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      cache: true,
      // Sem `ignoreEnvFile`: em desenvolvimento o .env e a fonte; em producao
      // as variaveis vem do ambiente e o arquivo simplesmente nao existe.
      envFilePath: '.env',
      validate: validateEnv,
    }),
    DatabaseModule,
  ],
  providers: [
    // Via APP_FILTER e nao `app.useGlobalFilters` em main.ts: assim o
    // TestingModule e a suite E2E exercitam exatamente o filter que a aplicacao
    // usa, em vez de uma montagem paralela que pode divergir.
    { provide: APP_FILTER, useClass: DomainExceptionFilter },
  ],
})
export class AppModule {}
