import 'reflect-metadata';

import { NestFactory } from '@nestjs/core';

import { AppModule } from '../app.module';
import { DocumentTypesService } from '../modules/document-types/document-types.service';
import { EmployeeDocumentsService } from '../modules/employee-documents/employee-documents.service';
import { SubmissionsService } from '../modules/employee-documents/submissions.service';
import { EmployeesService } from '../modules/employees/employees.service';
import { DuplicatedResourceError } from '../shared/errors';

/**
 * TASK-071. Passa pelos services reais (`create`/`vincular`/`enviar`), não
 * por `INSERT` cru: reaproveita validação e transação já existentes em vez
 * de duplicar regra de negócio num script solto — mesmo raciocínio que faz
 * a suíte E2E (TASK-069) bater em HTTP em vez de tocar o banco direto, um
 * nível abaixo.
 *
 * Dados propositalmente desbalanceados, para os três endpoints de
 * `/statistics` responderem algo que não seja `0`, `100` nem lista vazia:
 * dois colaboradores totalmente conformes (um deles com reenvio, para
 * aparecer versão superada em `latest-submissions`), dois com pendência
 * parcial, e um sem nenhum vínculo (conta em `employeesWithoutRequirements`,
 * fora do denominador de `employeesFullyCompliantPercentage`).
 */
async function seed(): Promise<void> {
  const app = await NestFactory.createApplicationContext(AppModule, { logger: false });

  const employees = app.get(EmployeesService);
  const documentTypes = app.get(DocumentTypesService);
  const employeeDocuments = app.get(EmployeeDocumentsService);
  const submissions = app.get(SubmissionsService);

  try {
    const cpf = await documentTypes.create({ name: 'CPF' });
    const rg = await documentTypes.create({ name: 'RG' });
    const comprovante = await documentTypes.create({ name: 'Comprovante de Residência' });

    const ana = await employees.create({ name: 'Ana Demonstração', email: 'ana@seed.demo' });
    const bruno = await employees.create({ name: 'Bruno Demonstração', email: 'bruno@seed.demo' });
    const carla = await employees.create({ name: 'Carla Demonstração', email: 'carla@seed.demo' });
    const diego = await employees.create({ name: 'Diego Demonstração', email: 'diego@seed.demo' });
    await employees.create({ name: 'Elisa Demonstração', email: 'elisa@seed.demo' });

    // Ana: conforme nos três, e reenvia o CPF (v1 fica superada, v2 ativa).
    const [vinculoAnaCpf, vinculoAnaRg, vinculoAnaComprovante] = await employeeDocuments.vincular({
      employeeId: ana.id,
      documentTypeIds: [cpf.id, rg.id, comprovante.id],
    });
    await submissions.enviar(vinculoAnaCpf.id);
    await submissions.enviar(vinculoAnaCpf.id);
    await submissions.enviar(vinculoAnaRg.id);
    await submissions.enviar(vinculoAnaComprovante.id);

    // Bruno: conforme nos três, sem reenvio.
    const [vinculoBrunoCpf, vinculoBrunoRg, vinculoBrunoComprovante] =
      await employeeDocuments.vincular({
        employeeId: bruno.id,
        documentTypeIds: [cpf.id, rg.id, comprovante.id],
      });
    await submissions.enviar(vinculoBrunoCpf.id);
    await submissions.enviar(vinculoBrunoRg.id);
    await submissions.enviar(vinculoBrunoComprovante.id);

    // Carla: só o CPF entregue, RG fica pendente.
    const [vinculoCarlaCpf] = await employeeDocuments.vincular({
      employeeId: carla.id,
      documentTypeIds: [cpf.id, rg.id],
    });
    await submissions.enviar(vinculoCarlaCpf.id);

    // Diego: vinculado, nada entregue — inteiramente pendente.
    await employeeDocuments.vincular({
      employeeId: diego.id,
      documentTypeIds: [comprovante.id],
    });

    // Elisa fica sem nenhum vínculo, de propósito.

    console.log(
      'Seed aplicado: 3 tipos de documento, 5 colaboradores (2 conformes, 2 parciais, 1 sem vínculo).',
    );
  } catch (erro) {
    if (erro instanceof DuplicatedResourceError) {
      console.log('Seed já aplicado antes (e-mail @seed.demo já cadastrado) — nada a fazer.');
    } else {
      throw erro;
    }
  } finally {
    await app.close();
  }
}

seed()
  .then(() => process.exit(0))
  .catch((erro: unknown) => {
    console.error(erro);
    process.exit(1);
  });
