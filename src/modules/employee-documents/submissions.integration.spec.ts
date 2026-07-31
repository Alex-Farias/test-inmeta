import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../database/migrations/1785416355470-CreateEmployees';
import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { CreateEmployeeDocuments1785453770311 } from '../../database/migrations/1785453770311-CreateEmployeeDocuments';
import { CreateDocumentSubmissions1785470132175 } from '../../database/migrations/1785470132175-CreateDocumentSubmissions';
import { EntityNotFoundError } from '../../shared/errors';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { DocumentType } from '../document-types/domain/document-type.entity';
import { Employee } from '../employees/domain/employee.entity';
import { DocumentSubmission } from './domain/document-submission.entity';
import { EmployeeDocument } from './domain/employee-document.entity';
import { EmployeeDocumentsRepository } from './employee-documents.repository';
import { SubmissionsRepository } from './submissions.repository';
import { SubmissionsService } from './submissions.service';

describe('SubmissionsService (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let service: SubmissionsService;
  let repository: SubmissionsRepository;

  async function criarVinculo(nomeDoTipo: string): Promise<EmployeeDocument> {
    const employees = dataSource.getRepository(Employee);
    const documentTypes = dataSource.getRepository(DocumentType);
    const vinculos = dataSource.getRepository(EmployeeDocument);

    const employee = await employees.save(
      employees.create({ name: 'Ana', email: `ana-${nomeDoTipo}@example.com` }),
    );
    const documentType = await documentTypes.save(documentTypes.create({ name: nomeDoTipo }));

    return vinculos.save(
      vinculos.create({ employeeId: employee.id, documentTypeId: documentType.id }),
    );
  }

  beforeAll(async () => {
    container = await new PostgreSqlContainer('postgres:18-alpine').start();

    dataSource = new DataSource({
      type: 'postgres',
      host: container.getHost(),
      port: container.getPort(),
      username: container.getUsername(),
      password: container.getPassword(),
      database: container.getDatabase(),
      entities: [Employee, DocumentType, EmployeeDocument, DocumentSubmission],
      migrations: [
        CreateEmployees1785416355470,
        CreateDocumentTypes1785446317559,
        CreateEmployeeDocuments1785453770311,
        CreateDocumentSubmissions1785470132175,
      ],
      synchronize: false,
    });
    await dataSource.initialize();
    await dataSource.runMigrations();

    repository = new SubmissionsRepository(dataSource);
    service = new SubmissionsService(
      repository,
      new EmployeeDocumentsRepository(dataSource),
      new TransactionRunner(dataSource),
    );
  }, 120_000);

  afterAll(async () => {
    await dataSource?.destroy();
    await container?.stop();
  });

  afterEach(async () => {
    await dataSource.query(
      'TRUNCATE TABLE document_submissions, employee_documents, employees, document_types',
    );
  });

  describe('reenvio', () => {
    it('desativa o envio anterior e registra o próximo como ativo', async () => {
      const vinculo = await criarVinculo('CPF');

      const primeiro = await service.enviar(vinculo.id);
      const segundo = await service.enviar(vinculo.id);

      expect(primeiro.version).toBe(1);
      expect(segundo.version).toBe(2);

      const submissions = dataSource.getRepository(DocumentSubmission);
      expect((await submissions.findOneBy({ id: primeiro.id }))?.isActive).toBe(false);
      expect((await submissions.findOneBy({ id: segundo.id }))?.isActive).toBe(true);

      // REQ-07.2: a versao anterior continua no banco, apenas inativa.
      expect(await submissions.count()).toBe(2);
    });

    it('mantém a sequência de versões contígua ao longo de vários reenvios', async () => {
      const vinculo = await criarVinculo('RG');

      for (let esperada = 1; esperada <= 4; esperada += 1) {
        const enviado = await service.enviar(vinculo.id);
        expect(enviado.version).toBe(esperada);
      }

      const submissions = dataSource.getRepository(DocumentSubmission);
      const ativas = await submissions.findBy({ isActive: true });
      expect(ativas).toHaveLength(1);
      expect(ativas[0].version).toBe(4);
    });

    it('desfaz a desativação do anterior se a inserção falhar', async () => {
      const vinculo = await criarVinculo('ASO');
      const primeiro = await service.enviar(vinculo.id);

      // E aqui que a transacao se paga: sem ela a desativacao ja teria
      // commitado, e o vinculo ficaria sem envio ativo nenhum. O indice
      // impede dois ativos; so a transacao impede zero (REQ-07.6).
      const falha = jest
        .spyOn(repository, 'create')
        .mockRejectedValueOnce(new Error('falha na insercao'));

      await expect(service.enviar(vinculo.id)).rejects.toThrow('falha na insercao');
      falha.mockRestore();

      const submissions = dataSource.getRepository(DocumentSubmission);
      expect((await submissions.findOneBy({ id: primeiro.id }))?.isActive).toBe(true);
      expect(await submissions.count()).toBe(1);
    });
  });

  /**
   * REQ-06.4, REQ-06.5 e REQ-14.8 — os tres casos que `findSubmittableById`
   * fecha, e a razao de ele existir separado de `findActiveById`.
   *
   * **Por que integracao e nao unidade.** O caso equivalente em
   * `submissions.service.spec.ts` mocka o repositorio: ele prova que o service
   * ramifica quando vem `null`, e passaria igual se a consulta nao tivesse JOIN
   * nenhum. O que decide REQ-06.5 e **quando** a consulta devolve `null`, e isso
   * so o Postgres responde.
   */
  describe('vínculo inválido', () => {
    /** Nenhum envio gravado — o 404 vem antes de qualquer escrita. */
    async function esperarRecusa(id: string): Promise<void> {
      await expect(service.enviar(id)).rejects.toThrow(EntityNotFoundError);
      expect(await dataSource.getRepository(DocumentSubmission).count()).toBe(0);
    }

    it('responde não encontrado para vínculo inexistente', async () => {
      await esperarRecusa('3f7c1e9a-2b64-4d05-9a18-6c0e5b7d4a21');
    });

    it('responde não encontrado para vínculo removido', async () => {
      const vinculo = await criarVinculo('CTPS');
      await dataSource
        .getRepository(EmployeeDocument)
        .update({ id: vinculo.id }, { deletedAt: new Date(), deletionCause: 'MANUAL' });

      await esperarRecusa(vinculo.id);
    });

    it('responde não encontrado para vínculo de colaborador removido', async () => {
      const vinculo = await criarVinculo('Diploma');

      // O colaborador e removido **direto pelo dataSource**, sem passar pelo
      // service que dispara a cascata. E de proposito: o vinculo fica com
      // `deleted_at NULL`, que e o estado que so o JOIN alcanca. Removido pelo
      // service, ele ja viria marcado e este caso seria repeticao do anterior —
      // passaria mesmo sem JOIN algum, provando a cascata em vez do requisito.
      //
      // D-06 diz que a cascata e defesa em profundidade e o JOIN e a garantia
      // primaria. Este teste e o que sustenta essa frase para REQ-06.5.
      await dataSource
        .getRepository(Employee)
        .update({ id: vinculo.employeeId }, { deletedAt: new Date() });

      await esperarRecusa(vinculo.id);
    });

    it('responde não encontrado para vínculo de tipo removido', async () => {
      const vinculo = await criarVinculo('Comprovante');

      // Mesma construcao, do outro lado do vinculo (REQ-14.8): escrita sobre
      // registro cujo contexto foi removido responde 404, nao erro interno.
      // Enviar documento de um tipo que a organizacao deixou de exigir nao tem
      // significado.
      await dataSource
        .getRepository(DocumentType)
        .update({ id: vinculo.documentTypeId }, { deletedAt: new Date() });

      await esperarRecusa(vinculo.id);
    });
  });

  /**
   * REQ-08.4 pela porta que o cliente usa. O equivalente em
   * `submissions.repository.integration.spec.ts` monta o ciclo chamando o
   * repositorio direto; este passa por `enviar` e `removerEnvioAtivo`, que e
   * como a sequencia acontece de verdade — e por isso enxerga tambem a ordem em
   * que `enviar` desativa, recalcula e insere.
   *
   * E o teste que falha se alguem "corrigir" o `withDeleted()` de
   * `findNextVersion` por parecer vazamento de soft delete. O comentario la
   * pede que se pare antes de mexer; este e o que cobra.
   */
  describe('versão após remoção', () => {
    it('continua a contagem de versões após a remoção do envio ativo', async () => {
      const vinculo = await criarVinculo('Ficha');
      const primeiro = await service.enviar(vinculo.id);
      expect(primeiro.version).toBe(1);

      await service.removerEnvioAtivo(vinculo.id);

      const segundo = await service.enviar(vinculo.id);

      // Nao volta a ser 1: o numero ja emitido esta queimado neste vinculo
      // (REQ-08.4), mesmo com a linha que o usava removida.
      expect(segundo.version).toBe(2);
      expect(segundo.isActive).toBe(true);

      const historico = await service.consultarHistorico(vinculo.id, { page: 1, limit: 20 });
      expect(historico.items.map((envio) => envio.version)).toEqual([2, 1]);

      // A versao 1 continua removida — o novo envio nao a ressuscitou, e o
      // buraco na sequencia que o historico evitaria mostrar nao existe.
      expect(historico.items[1].deletedAt).toBeInstanceOf(Date);
    });

    it('mantém o vínculo pendente enquanto não há novo envio', async () => {
      const vinculo = await criarVinculo('Acordo');
      await service.enviar(vinculo.id);

      await service.removerEnvioAtivo(vinculo.id);

      // O estado que D-13 declara valido e esperado: vinculo **pendente com
      // historico**. Nenhuma versao anterior foi reativada, e a pendencia se le
      // da ausencia de envio ativo, nao de coluna de estado (D-03).
      const submissions = dataSource.getRepository(DocumentSubmission);
      expect(await submissions.countBy({ employeeDocumentId: vinculo.id, isActive: true })).toBe(0);

      const historico = await service.consultarHistorico(vinculo.id, { page: 1, limit: 20 });
      expect(historico.total).toBe(1);
    });

    it('responde não encontrado ao remover envio já removido', async () => {
      const vinculo = await criarVinculo('Aditivo');
      await service.enviar(vinculo.id);
      await service.removerEnvioAtivo(vinculo.id);

      // REQ-08.6 contra Postgres real: o `deleted_at IS NULL` do predicado faz o
      // segundo `UPDATE` afetar zero linhas em vez de reescrever a data.
      await expect(service.removerEnvioAtivo(vinculo.id)).rejects.toThrow(EntityNotFoundError);
    });
  });

  /**
   * REQ-09.4, REQ-09.5 e REQ-14.6 — a **excecao declarada a REQ-14.2**, e a
   * unica do sistema (design 4.3).
   *
   * O contraste com o `describe` acima e o ponto: para **enviar**, vinculo ou
   * colaborador removido da 404 (TASK-043); para **consultar o historico**, os
   * mesmos estados dao 200 com o historico completo. Sao dois metodos com
   * proposito oposto sobre a mesma tabela — `findSubmittableById` e
   * `findAnyById` —, e trocar um pelo outro quebraria um requisito em silencio.
   */
  describe('histórico após remoção', () => {
    const paginacao = { page: 1, limit: 20 };

    it('histórico segue acessível após remoção do colaborador', async () => {
      const vinculo = await criarVinculo('Contrato');
      await service.enviar(vinculo.id);
      await service.enviar(vinculo.id);

      // Colaborador e vinculo removidos, como a cascata de TASK-032 os deixaria.
      await dataSource
        .getRepository(Employee)
        .update({ id: vinculo.employeeId }, { deletedAt: new Date() });
      await dataSource
        .getRepository(EmployeeDocument)
        .update({ id: vinculo.id }, { deletedAt: new Date(), deletionCause: 'EMPLOYEE_REMOVED' });

      const historico = await service.consultarHistorico(vinculo.id, paginacao);

      // REQ-09.5: o historico nao encolhe nem muda por causa da remocao do pai.
      expect(historico.total).toBe(2);
      expect(historico.items.map((envio) => envio.version)).toEqual([2, 1]);

      // E o que prova a **ausencia de cascata** ate `document_submissions`: se
      // algo propagasse ate la, estes `deletedAt` estariam preenchidos e a
      // terceira linha da tabela de 4.3 passaria a significar outra coisa.
      expect(historico.items.every((envio) => envio.deletedAt === null)).toBe(true);
      expect(historico.items[0].isActive).toBe(true);
    });

    it('histórico segue acessível após remoção do vínculo', async () => {
      const vinculo = await criarVinculo('Termo');
      await service.enviar(vinculo.id);

      await dataSource
        .getRepository(EmployeeDocument)
        .update({ id: vinculo.id }, { deletedAt: new Date(), deletionCause: 'MANUAL' });

      const historico = await service.consultarHistorico(vinculo.id, paginacao);

      // REQ-09.4. Note o contraste com `enviar`, que recusa este mesmo vinculo.
      expect(historico.total).toBe(1);
      expect(historico.items[0].version).toBe(1);

      await expect(service.enviar(vinculo.id)).rejects.toThrow(EntityNotFoundError);
    });

    it('responde não encontrado para vínculo que nunca existiu', async () => {
      // O que `findAnyById` compra sobre consultar as submissions direto:
      // removido devolve historico, inexistente devolve 404. Sem a distincao,
      // uuid digitado errado responderia 200 com pagina vazia, afirmando que o
      // vinculo existe e nao tem envios.
      await expect(
        service.consultarHistorico('9d2f8c31-4a07-4b62-8e15-7c3b0a6d5e94', paginacao),
      ).rejects.toThrow(EntityNotFoundError);
    });
  });
});
