import { validateEnv } from './env.validation';

const envCompleto = {
  NODE_ENV: 'development',
  PORT: '3000',
  DB_HOST: 'localhost',
  DB_PORT: '5432',
  DB_USER: 'postgres',
  DB_PASSWORD: 'postgres',
  DB_NAME: 'documentacao',
};

describe('validateEnv', () => {
  it('falha na inicialização identificando a variável ausente', () => {
    const semSenha: Record<string, string> = { ...envCompleto };
    delete semSenha.DB_PASSWORD;

    expect(() => validateEnv(semSenha)).toThrow(/DB_PASSWORD/);
  });

  it('falha identificando a variável com valor inválido', () => {
    expect(() => validateEnv({ ...envCompleto, DB_PORT: 'nao-e-numero' })).toThrow(/DB_PORT/);
  });

  it('aceita configuração completa e converte as portas para número', () => {
    const validado = validateEnv(envCompleto);

    expect(validado.DB_PORT).toBe(5432);
    expect(validado.PORT).toBe(3000);
  });
});
