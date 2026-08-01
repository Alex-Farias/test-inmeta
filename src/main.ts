import { NestFactory } from '@nestjs/core';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

import { AppModule } from './app.module';

// REQ-22.1/22.3. Rotas e DTOs documentam requisicao/resposta por si (REQ-22.2,
// REQ-22.4 — mesmos decorators que o ValidationPipe global consome); o
// catalogo de codigos de erro nao tem um lugar estrutural no OpenAPI (nao e
// por rota, e transversal a todas), entao fica descrito aqui.
const DESCRICAO_API = `API de gestão de documentação de colaboradores.

## Catálogo de códigos de erro (design.md §4.6)

Toda falha responde no mesmo formato (\`ErrorResponseDto\`), qualquer que seja a origem:

| Código | HTTP | Significado |
|---|---|---|
| \`NOT_FOUND\` | 404 | Recurso inexistente ou removido |
| \`VALIDATION_ERROR\` | 400 | Entrada mal formada |
| \`BUSINESS_RULE_VIOLATION\` | 422 | Regra de domínio violada |
| \`DUPLICATED_RESOURCE\` | 409 | Unicidade violada (default da tabela) |
| \`CONCURRENT_SUBMISSION\` | 409 | Corrida legítima entre dois envios — repetir resolve |
| \`VERSION_CONFLICT\` | 409 | Defeito de cálculo de versão — repetir não resolve |
| \`INTERNAL_ERROR\` | 500 | Falha não prevista, sem detalhe interno vazado |`;

async function bootstrap(): Promise<void> {
  // `bufferLogs` retem log de bootstrap ate `useLogger` trocar o logger padrao
  // do Nest pelo pino — sem isso, log emitido antes desse ponto sai no
  // formato antigo, nao estruturado (REQ-20.1).
  const app = await NestFactory.create(AppModule, { bufferLogs: true });
  app.useLogger(app.get(Logger));

  const documento = SwaggerModule.createDocument(
    app,
    new DocumentBuilder()
      .setTitle('Documentação de colaboradores')
      .setDescription(DESCRICAO_API)
      .setVersion('1.0')
      .build(),
  );
  SwaggerModule.setup('docs', app, documento);

  await app.listen(process.env.PORT ?? 3000);
}

void bootstrap();
