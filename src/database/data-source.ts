import { config as loadDotenv } from 'dotenv';
import { DataSource } from 'typeorm';
// Na linha 1.x o tipo se chama PostgresDataSourceOptions — era
// PostgresConnectionOptions na 0.3.x — e nao e reexportado da raiz do pacote.
import type { PostgresDataSourceOptions } from 'typeorm/driver/postgres/PostgresDataSourceOptions';

import { validateEnv } from '../config/env.validation';

// O CLI do TypeORM consome este arquivo fora do contexto do Nest (D-11), entao
// ninguem carregou o .env por nos. A validacao e a mesma do bootstrap: uma
// migration rodando com configuracao invalida e o pior momento para descobrir.
loadDotenv();
const env = validateEnv(process.env);

// Tipado como PostgresConnectionOptions, nao como DataSourceOptions: a uniao
// cobre todos os drivers, e espalha-la em outro objeto perde a especializacao.
export const dataSourceOptions: PostgresDataSourceOptions = {
  type: 'postgres',
  host: env.DB_HOST,
  port: env.DB_PORT,
  username: env.DB_USER,
  password: env.DB_PASSWORD,
  database: env.DB_NAME,
  entities: [__dirname + '/../modules/**/domain/*.entity{.ts,.js}'],
  migrations: [__dirname + '/migrations/*{.ts,.js}'],
  // D-11, sem excecao e inclusive em desenvolvimento. `synchronize` produz
  // divergencia silenciosa entre schemas e nao gera os indices parciais de que
  // este projeto depende; `migrationsRun` esconde a migracao dentro do boot,
  // quando ela precisa ser passo explicito.
  synchronize: false,
  migrationsRun: false,
};

export default new DataSource(dataSourceOptions);
