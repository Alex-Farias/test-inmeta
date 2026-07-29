import type { Config } from 'jest';

/**
 * Suite unitaria. Cobre regra de dominio pura, mapeamento de erro e calculo —
 * nada que toque o banco (design.md, secao 5).
 *
 * A separacao da suite de integracao e por padrao de nome, nao por diretorio:
 * o teste unitario mora ao lado do codigo que prova, e `*.integration.spec.ts`
 * e o unico marcador que decide a rota.
 */
const config: Config = {
  rootDir: '.',
  roots: ['<rootDir>/src'],
  testEnvironment: 'node',
  testRegex: '\\.spec\\.ts$',
  testPathIgnorePatterns: ['\\.integration\\.spec\\.ts$'],
  transform: {
    '^.+\\.ts$': ['ts-jest', { tsconfig: '<rootDir>/tsconfig.json' }],
  },
  moduleFileExtensions: ['ts', 'js', 'json'],
  collectCoverageFrom: ['src/**/*.ts', '!src/main.ts', '!src/**/*.spec.ts'],
  coverageDirectory: '<rootDir>/coverage/unit',
};

export default config;
