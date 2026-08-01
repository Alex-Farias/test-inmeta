import { expect, test } from '@playwright/test';

/**
 * Único teste da suíte (design.md §5): vincular, enviar, reenviar, consultar
 * histórico, remover e conferir estatística — via HTTP real contra o serviço
 * subido pelo `webServer` do `playwright.config.ts`, não em processo (D-16 e
 * a nota de `stack.md` sobre Supertest não exercitar o binding de rede).
 *
 * O Postgres do compose é persistente entre execuções, então nome/e-mail
 * usam um sufixo único (timestamp) para não colidir com dado de execuções
 * anteriores, e o teste limpa o colaborador que criou ao final.
 */
test('percorre o ciclo de vida de um documento', async ({ request }) => {
  const sufixo = Date.now();

  const colaborador = await request.post('/employees', {
    data: { name: `Colaborador E2E ${sufixo}`, email: `e2e-${sufixo}@teste.com` },
  });
  expect(colaborador.status()).toBe(201);
  const { id: employeeId } = (await colaborador.json()) as { id: string };

  const tipo = await request.post('/document-types', {
    data: { name: `Tipo E2E ${sufixo}` },
  });
  expect(tipo.status()).toBe(201);
  const { id: documentTypeId } = (await tipo.json()) as { id: string };

  // REQ-03 — vincula em lote.
  const vinculo = await request.post('/employee-documents', {
    data: { employeeId, documentTypeIds: [documentTypeId] },
  });
  expect(vinculo.status()).toBe(201);
  const [{ id: employeeDocumentId }] = (await vinculo.json()) as { id: string }[];

  // REQ-10 — pendente logo após o vínculo, sem envio.
  const pendentesAntesDoEnvio = await request.get('/employee-documents/pending', {
    params: { employeeId },
  });
  expect(pendentesAntesDoEnvio.status()).toBe(200);
  const { items: pendentesAntes } = (await pendentesAntesDoEnvio.json()) as {
    items: { id: string }[];
  };
  expect(pendentesAntes.map((item) => item.id)).toContain(employeeDocumentId);

  // REQ-06 — primeiro envio, versão 1.
  const envio1 = await request.post(`/employee-documents/${employeeDocumentId}/submissions`);
  expect(envio1.status()).toBe(201);
  const submissao1 = (await envio1.json()) as { version: number; isActive: boolean };
  expect(submissao1).toMatchObject({ version: 1, isActive: true });

  // REQ-10 — some de pendentes com envio ativo.
  const pendentesAposEnvio = await request.get('/employee-documents/pending', {
    params: { employeeId },
  });
  const { items: pendentesDepois } = (await pendentesAposEnvio.json()) as {
    items: { id: string }[];
  };
  expect(pendentesDepois.map((item) => item.id)).not.toContain(employeeDocumentId);

  // REQ-07 — reenvio, versão incrementada, sem exigir corpo.
  const envio2 = await request.post(`/employee-documents/${employeeDocumentId}/submissions`);
  expect(envio2.status()).toBe(201);
  const submissao2 = (await envio2.json()) as { version: number; isActive: boolean };
  expect(submissao2).toMatchObject({ version: 2, isActive: true });

  // REQ-09 — histórico com as duas versões, só a mais recente ativa.
  const historicoResp = await request.get(`/employee-documents/${employeeDocumentId}/submissions`);
  expect(historicoResp.status()).toBe(200);
  const { items: historico, total } = (await historicoResp.json()) as {
    items: { version: number; isActive: boolean }[];
    total: number;
  };
  expect(total).toBe(2);
  const ativos = historico.filter((item) => item.isActive);
  expect(ativos).toHaveLength(1);
  expect(ativos[0].version).toBe(2);

  // REQ-08 — remove o envio ativo, sem reativar o anterior.
  const remocaoEnvio = await request.delete(
    `/employee-documents/${employeeDocumentId}/submissions/active`,
  );
  expect(remocaoEnvio.status()).toBe(204);

  // REQ-10 — volta a aparecer pendente, já que não há envio ativo.
  const pendentesAposRemocao = await request.get('/employee-documents/pending', {
    params: { employeeId },
  });
  const { items: pendentesFinal } = (await pendentesAposRemocao.json()) as {
    items: { id: string }[];
  };
  expect(pendentesFinal.map((item) => item.id)).toContain(employeeDocumentId);

  // REQ-16 — contrato do agregador. Base persistente entre execuções: o
  // formato é o que se prova aqui, não o valor exato (design.md §5 — E2E
  // cobre contrato HTTP, não estado interno; a matemática já é provada pelos
  // testes de integração de statistics contra banco efêmero).
  const overviewResp = await request.get('/statistics/overview');
  expect(overviewResp.status()).toBe(200);
  const overview = (await overviewResp.json()) as {
    employeesFullyCompliantPercentage: number;
    documentsSubmittedPercentage: number;
    employeesWithoutRequirements: number;
  };
  expect(overview.employeesFullyCompliantPercentage).toBeGreaterThanOrEqual(0);
  expect(overview.employeesFullyCompliantPercentage).toBeLessThanOrEqual(100);
  expect(overview.documentsSubmittedPercentage).toBeGreaterThanOrEqual(0);
  expect(overview.documentsSubmittedPercentage).toBeLessThanOrEqual(100);
  expect(overview.employeesWithoutRequirements).toBeGreaterThanOrEqual(0);

  // Limpeza — evita acumular dado de teste no volume persistente do compose.
  const remocaoColaborador = await request.delete(`/employees/${employeeId}`);
  expect(remocaoColaborador.status()).toBe(204);
});
