import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';

import { validateEnv } from './config/env.validation';

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
  ],
})
export class AppModule {}
