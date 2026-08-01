import { NestFactory } from '@nestjs/core';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

async function bootstrap(): Promise<void> {
  // `bufferLogs` retem log de bootstrap ate `useLogger` trocar o logger padrao
  // do Nest pelo pino — sem isso, log emitido antes desse ponto sai no
  // formato antigo, nao estruturado (REQ-20.1).
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));
  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
