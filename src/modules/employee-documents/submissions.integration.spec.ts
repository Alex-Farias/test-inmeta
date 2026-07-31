import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../database/migrations/1785416355470-CreateEmployees';
import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { CreateEmployeeDocuments1785453770311 } from '../../database/migrations/1785453770311-CreateEmployeeDocuments';
import { CreateDocumentSubmissions1785470132175 } from '../../database/migrations/1785470132175-CreateDocumentSubmissions';
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
});
