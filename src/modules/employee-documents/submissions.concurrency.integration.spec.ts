import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../database/migrations/1785416355470-CreateEmployees';
import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { CreateEmployeeDocuments1785453770311 } from '../../database/migrations/1785453770311-CreateEmployeeDocuments';
import { CreateDocumentSubmissions1785470132175 } from '../../database/migrations/1785470132175-CreateDocumentSubmissions';
import { ConcurrentSubmissionError } from '../../shared/errors';
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

    service = new SubmissionsService(
      new SubmissionsRepository(dataSource),
      new EmployeeDocumentsRepository(dataSource),
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

      const resultados = await Promise.allSettled([
        service.enviar(vinculo.id),
        service.enviar(vinculo.id),
      ]);

      const cumpridas = resultados.filter((resultado) => resultado.status === 'fulfilled');
      const rejeitadas = resultados.filter((resultado) => resultado.status === 'rejected');

      expect(cumpridas).toHaveLength(1);
      expect(rejeitadas).toHaveLength(1);

      // 409, nao 500 cru: e a traducao de 23505 que a TASK-038 introduziu, aqui
      // provada contra o Postgres real em vez de erro fabricado por mock.
      const [rejeitada] = rejeitadas;
      expect(rejeitada.reason).toBeInstanceOf(ConcurrentSubmissionError);

      // REQ-07.3, "EM QUALQUER MOMENTO": uma linha so, e sem versao orfa
      // deixada pela perdedora.
      const linhas = await dataSource.getRepository(DocumentSubmission).find({ withDeleted: true });
      expect(linhas).toHaveLength(1);
      expect(linhas[0].version).toBe(1);
      expect(linhas[0].isActive).toBe(true);
    });
  });
});
