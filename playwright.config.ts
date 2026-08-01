import { defineConfig } from '@playwright/test';

const PORT = process.env.PORT ?? '3000';
const BASE_URL = `http://localhost:${PORT}`;

/**
 * Único caminho do projeto que bate na porta HTTP real do serviço (design.md
 * §5) — sem browser, só `APIRequestContext`. Exige o Postgres do
 * `docker-compose` no ar e migrado (stack.md, seção "Testes"); a própria
 * aplicação sobe via `webServer` abaixo, reaproveitando `/health` (TASK-064)
 * como sinal de prontidão em vez de um `sleep` arbitrário.
 */
export default defineConfig({
  testDir: './test/e2e',
  fullyParallel: false,
  retries: 0,
  reporter: 'list',
  use: {
    baseURL: BASE_URL,
  },
  webServer: {
    command: 'npm run start',
    url: `${BASE_URL}/health`,
    // Se já tiver uma instância no ar (ex.: `npm run start:dev` num terminal
    // à parte), reaproveita — só CI força um processo isolado por execução.
    reuseExistingServer: !process.env.CI,
    timeout: 60_000,
  },
});
