import { MiddlewareConsumer, Module, NestModule } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { APP_FILTER, APP_PIPE } from '@nestjs/core';

import { validateEnv } from './config/env.validation';
import { DatabaseModule } from './database/database.module';
import { DomainExceptionFilter } from './shared/filters/domain-exception.filter';
import { RequestIdMiddleware } from './shared/http/request-id.middleware';
import { criarValidationPipe } from './shared/pipes/validation-pipe.factory';

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
    // Mesma razao do filter: via APP_PIPE, para que teste e producao usem a
    // mesma configuracao de validacao.
    { provide: APP_PIPE, useFactory: criarValidationPipe },
  ],
})
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    // Em todas as rotas, nao so nas que falham: o id precisa existir antes de
    // se saber se a requisicao vai dar erro.
    consumer.apply(RequestIdMiddleware).forRoutes('*');
  }
}
