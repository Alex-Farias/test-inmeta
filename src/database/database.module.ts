import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';

import { dataSourceOptions } from './data-source';

/**
 * Consome exatamente as opcoes que o CLI do TypeORM consome. Nao ha
 * `forRootAsync` sobre o ConfigService aqui de proposito: as variaveis ja
 * passaram por `validateEnv` dentro de `data-source.ts`, e reconstruir a
 * conexao a partir do ConfigService criaria uma segunda descricao do mesmo
 * banco. Duas descricoes divergem, e a que diverge em silencio e justamente a
 * do CLI — que e quem aplica migration.
 */
@Module({
  imports: [TypeOrmModule.forRoot(dataSourceOptions)],
})
export class DatabaseModule {}
