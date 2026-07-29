import type { Config } from 'jest';

/**
 * Suite de integracao. Cobre repositorio, transacao, concorrencia, soft delete
 * em join e indice parcial — tudo contra Postgres real via Testcontainers
 * (design.md, secao 5).
 *
 * `maxWorkers: 1` porque cada suite sobe container proprio: paralelismo aqui
 * troca minutos de CPU por contencao de Docker. O timeout alto cobre o pull e
 * a subida da imagem na primeira execucao.
 */
const config: Config = {
  rootDir: '..',
  roots: ['<rootDir>/src', '<rootDir>/test/integration'],
  testEnvironment: 'node',
  // Mesma razao da suite unitaria: decorators leem metadata em runtime.
  setupFiles: ['reflect-metadata'],
  testRegex: '\\.integration\\.spec\\.ts$',
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  maxWorkers: 1,
  testTimeout: 120_000,
  coverageDirectory: '<rootDir>/coverage/integration',
};

export default config;
