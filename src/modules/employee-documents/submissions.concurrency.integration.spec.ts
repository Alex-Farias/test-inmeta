import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../database/migrations/1785416355470-CreateEmployees';
import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { CreateEmployeeDocuments1785453770311 } from '../../database/migrations/1785453770311-CreateEmployeeDocuments';
import { CreateDocumentSubmissions1785470132175 } from '../../database/migrations/1785470132175-CreateDocumentSubmissions';
import { criarBarreira, sincronizarEm } from '../../../test/helpers/concurrent-transactions';
import { ConcurrentSubmissionError, VersionConflictError } from '../../shared/errors';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { DocumentType } from '../document-types/domain/document-type.entity';
import { Employee } from '../employees/domain/employee.entity';
import { DocumentSubmission } from './domain/document-submission.entity';
import { EmployeeDocument } from './domain/employee-document.entity';
import { EmployeeDocumentsRepository } from './employee-documents.repository';
import { SubmissionsRepository } from './submissions.repository';
import { SubmissionsService } from './submissions.service';

/**
 * Concorrencia no **primeiro** envio: duas insercoes disputando uma linha que
 * ainda nao existe. A corrida de **reenvio** — duas transacoes disputando
 * desativar a linha existente e inserir a proxima — e a TASK-042, e mora neste
 * mesmo arquivo. Mesma constraint, dois caminhos de codigo distintos.
 */
describe('Submissions — concorrência (integration)', () => {
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

  describe('primeiro envio', () => {
    it('persiste exatamente um de dois primeiros envios simultâneos', async () => {
      const vinculo = await criarVinculo('CPF');

      // A barreira em `findNextVersion` prende as duas chamadas depois de a
      // transacao abrir e antes da insercao disputada. Sem ela, `Promise.all`
      // deixa a primeira commitar antes de a segunda comecar, e o teste passa
      // sem que sobreposicao alguma tenha ocorrido — ver design.md, secao 5.
      const barreira = criarBarreira(2);
      const restaurar = sincronizarEm(repository, 'findNextVersion', barreira);

      let resultados: PromiseSettledResult<unknown>[];
      try {
        resultados = await Promise.allSettled([
          service.enviar(vinculo.id),
          service.enviar(vinculo.id),
        ]);
      } finally {
        restaurar();
      }

      const cumpridas = resultados.filter((resultado) => resultado.status === 'fulfilled');
      const rejeitadas = resultados.filter((resultado) => resultado.status === 'rejected');

      expect(cumpridas).toHaveLength(1);
      expect(rejeitadas).toHaveLength(1);

      // 409, nao 500 cru: e a traducao de 23505 que a TASK-038 introduziu, aqui
      // provada contra o Postgres real em vez de erro fabricado por mock.
      //
      // **Qualquer um dos dois**, e nao um tipo fixo. Nesta corrida as duas
      // insercoes propoem `version = 1` e `is_active = true` sobre um vinculo
      // sem envio nenhum, entao a perdedora viola `uq_submission_active` **e**
      // `uq_submission_version` na mesma tentativa de escrita. Qual delas o
      // Postgres reporta e ordem de checagem interna: nao e contrato
      // documentado, nao e estavel entre versoes do servidor, e nao e estavel
      // nem sob recriacao dos indices, que muda os OIDs pelos quais eles sao
      // varridos. Assertar um tipo so acoplaria a suite a esse detalhe, e o
      // teste passaria a quebrar por atualizacao de Postgres em vez de por
      // regressao nossa.
      //
      // Nao e falha na taxonomia de D-14: as duas classes estao ambas certas
      // aqui, porque as duas invariantes foram ambas violadas. Ver design.md,
      // secao 5, "O limite da discriminacao de D-14" — este e o unico ponto do
      // sistema onde a discriminacao nao e deterministica. No reenvio ela e
      // exata, porque ja existe linha ativa e a perdedora colide em
      // `uq_submission_active` sem chance de propor versao repetida.
      const [rejeitada] = rejeitadas;
      expect([ConcurrentSubmissionError, VersionConflictError]).toContain(
        (rejeitada.reason as Error).constructor,
      );

      // REQ-07.3, "EM QUALQUER MOMENTO": uma linha so, e sem versao orfa
      // deixada pela perdedora.
      const linhas = await dataSource.getRepository(DocumentSubmission).find({ withDeleted: true });
      expect(linhas).toHaveLength(1);
      expect(linhas[0].version).toBe(1);
      expect(linhas[0].isActive).toBe(true);
    });
  });

  describe('reenvio', () => {
    it('persiste exatamente um de dois reenvios simultâneos', async () => {
      const vinculo = await criarVinculo('RG');

      // Estado anterior a preservar — e o que distingue esta corrida da de
      // primeiro envio. La as duas insercoes disputam uma linha que ainda nao
      // existe; aqui as duas transacoes disputam **desativar a linha existente
      // e inserir a proxima**, e REQ-07.6 so pode falhar de verdade neste
      // caminho, porque so ele tem o que estragar.
      await service.enviar(vinculo.id);

      // A barreira vai em `deactivateActive`, e **nao** em `findNextVersion`
      // como no caso de primeiro envio. A diferenca nao e estetica: no reenvio
      // a primeira escrita e o `UPDATE` que desativa a v1, e ele toma lock de
      // linha. Com a barreira em `findNextVersion`, T1 passaria pelo `UPDATE`,
      // tomaria o lock e so entao esperaria; T2 bloquearia **no `UPDATE`**, sem
      // nunca alcancar a barreira. Um participante de dois chega, a barreira
      // nunca libera, e o teste morre por timeout. Ver design.md, secao 5.
      const barreira = criarBarreira(2);
      const restaurar = sincronizarEm(repository, 'deactivateActive', barreira);

      let resultados: PromiseSettledResult<unknown>[];
      try {
        resultados = await Promise.allSettled([
          service.enviar(vinculo.id),
          service.enviar(vinculo.id),
        ]);
      } finally {
        restaurar();
      }

      const cumpridas = resultados.filter((resultado) => resultado.status === 'fulfilled');
      const rejeitadas = resultados.filter((resultado) => resultado.status === 'rejected');

      // REQ-07.5: exatamente um persiste, o outro e rejeitado por conflito.
      expect(cumpridas).toHaveLength(1);
      expect(rejeitadas).toHaveLength(1);

      // Estrito, ao contrario do caso de primeiro envio, e de proposito: aqui a
      // discriminacao de D-14 **e** deterministica. A perdedora ja encontra uma
      // linha ativa commitada pela vencedora, entao calcula a versao seguinte a
      // ela — numero que ninguem tem — e colide so em `uq_submission_active`,
      // sem chance de propor versao repetida. E este caso que prova a
      // afirmacao de design.md, secao 5, de que a nao-determinacao se restringe
      // a corrida de primeiro envio.
      const [rejeitada] = rejeitadas;
      expect(rejeitada.reason).toBeInstanceOf(ConcurrentSubmissionError);

      const linhas = await dataSource
        .getRepository(DocumentSubmission)
        .find({ withDeleted: true, order: { version: 'ASC' } });

      // REQ-07.6, "sem versao orfa": a perdedora nao deixou rastro. Sao duas
      // linhas, nao tres — a v3 que ela tentou inserir sumiu no rollback.
      expect(linhas.map((linha) => linha.version)).toEqual([1, 2]);

      // REQ-07.3 e REQ-07.4: uma unica ativa, e a sequencia continua contigua.
      expect(linhas.filter((linha) => linha.isActive)).toHaveLength(1);
      expect(linhas[1].isActive).toBe(true);

      // O que este caso **nao** prova: que o rollback e o que impede o vinculo
      // de ficar sem envio ativo nenhum. Nesta interleaving o `UPDATE` da
      // perdedora destrava depois do commit da vencedora e afeta zero linhas —
      // a v1 ja nao casa o predicado —, entao nao ha desativacao a desfazer.
      // Quem impede o "zero ativo" aqui e o lock de linha. A prova do rollback
      // e "desfaz a desativacao do anterior se a insercao falhar", em
      // `submissions.integration.spec.ts`.
    });
  });
});
