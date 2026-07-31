import { PostgreSqlContainer, StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { DataSource } from 'typeorm';

import { CreateEmployees1785416355470 } from '../../database/migrations/1785416355470-CreateEmployees';
import { CreateDocumentTypes1785446317559 } from '../../database/migrations/1785446317559-CreateDocumentTypes';
import { CreateEmployeeDocuments1785453770311 } from '../../database/migrations/1785453770311-CreateEmployeeDocuments';
import { CreateDocumentSubmissions1785470132175 } from '../../database/migrations/1785470132175-CreateDocumentSubmissions';
import { DocumentType } from '../document-types/domain/document-type.entity';
import { Employee } from '../employees/domain/employee.entity';
import { DocumentSubmission } from './domain/document-submission.entity';
import { EmployeeDocument } from './domain/employee-document.entity';
import { SubmissionsRepository } from './submissions.repository';

describe('DocumentSubmission (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let repository: SubmissionsRepository;

  /** Vinculo ativo recem-criado, para pendurar os envios de cada teste. */
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

  describe('migration', () => {
    it('aplica os três índices declarados', async () => {
      const indices: { indexname: string; indexdef: string }[] = await dataSource.query(
        `SELECT indexname, indexdef FROM pg_indexes WHERE tablename = 'document_submissions'`,
      );
      const porNome = new Map(indices.map((indice) => [indice.indexname, indice.indexdef]));

      expect(porNome.get('uq_submission_active')).toMatch(/CREATE UNIQUE INDEX/);
      expect(porNome.get('uq_submission_active')).toMatch(
        /WHERE \(is_active AND \(deleted_at IS NULL\)\)/,
      );

      // A ausencia de WHERE e o ponto: este indice cobre todas as linhas,
      // inclusive removidas (REQ-08.4).
      expect(porNome.get('uq_submission_version')).toMatch(/CREATE UNIQUE INDEX/);
      expect(porNome.get('uq_submission_version')).not.toMatch(/WHERE/);

      expect(porNome.get('idx_submissions_recent')).toMatch(
        /\(submitted_at DESC, id DESC\)[\s\S]*WHERE \(deleted_at IS NULL\)/,
      );
    });

    it('rejeita segundo envio ativo para o mesmo vínculo', async () => {
      const vinculo = await criarVinculo('CPF');
      const submissions = dataSource.getRepository(DocumentSubmission);

      await submissions.save(
        submissions.create({
          employeeDocumentId: vinculo.id,
          version: 1,
          isActive: true,
          submittedAt: new Date(),
        }),
      );

      await expect(
        submissions.save(
          submissions.create({
            employeeDocumentId: vinculo.id,
            version: 2,
            isActive: true,
            submittedAt: new Date(),
          }),
        ),
      ).rejects.toThrow();
    });

    it('não reemite versão de envio removido', async () => {
      const vinculo = await criarVinculo('RG');
      const submissions = dataSource.getRepository(DocumentSubmission);

      const primeiro = await submissions.save(
        submissions.create({
          employeeDocumentId: vinculo.id,
          version: 1,
          isActive: true,
          submittedAt: new Date(),
        }),
      );
      await submissions.softDelete(primeiro.id);

      // `uq_submission_version` nao e parcial: mesmo removida, a versao 1
      // segue ocupando o slot. E a diferenca deliberada em relacao a todos os
      // outros indices unicos do projeto.
      await expect(
        submissions.save(
          submissions.create({
            employeeDocumentId: vinculo.id,
            version: 1,
            isActive: true,
            submittedAt: new Date(),
          }),
        ),
      ).rejects.toThrow();
    });
  });

  describe('findNextVersion', () => {
    it('começa em 1 para vínculo sem envio', async () => {
      const vinculo = await criarVinculo('ASO');

      await expect(repository.findNextVersion(vinculo.id)).resolves.toBe(1);
    });

    it('conta envios removidos ao calcular a próxima versão', async () => {
      const vinculo = await criarVinculo('CTPS');
      const submissions = dataSource.getRepository(DocumentSubmission);

      const primeiro = await repository.create(vinculo.id, 1);
      await submissions.softDelete(primeiro.id);

      // O `.withDeleted()` de `findNextVersion` e o que faz REQ-08.4 valer: se
      // filtrasse removidos, voltaria 1 de novo e `uq_submission_version` —
      // que nao e parcial — rejeitaria a insercao.
      await expect(repository.findNextVersion(vinculo.id)).resolves.toBe(2);
    });
  });

  describe('deactivateActive', () => {
    it('desativa o envio ativo do vínculo', async () => {
      const vinculo = await criarVinculo('CNH');
      const criado = await repository.create(vinculo.id, 1);

      await repository.deactivateActive(vinculo.id);

      const linha = await dataSource.getRepository(DocumentSubmission).findOneBy({ id: criado.id });
      expect(linha?.isActive).toBe(false);

      // Desativar nao remove: o historico de REQ-07.2 vive nestas linhas.
      expect(linha?.deletedAt).toBeNull();
    });

    it('não alcança envio de outro vínculo', async () => {
      const alvo = await criarVinculo('TITULO');
      const outro = await criarVinculo('RESERVISTA');
      const doAlvo = await repository.create(alvo.id, 1);
      const doOutro = await repository.create(outro.id, 1);

      await repository.deactivateActive(alvo.id);

      const submissions = dataSource.getRepository(DocumentSubmission);
      expect((await submissions.findOneBy({ id: doAlvo.id }))?.isActive).toBe(false);
      expect((await submissions.findOneBy({ id: doOutro.id }))?.isActive).toBe(true);
    });

    it('não falha quando o vínculo não tem envio ativo', async () => {
      const vinculo = await criarVinculo('DIPLOMA');

      // Zero linhas afetadas — e o que dispensa branch para o primeiro envio.
      await expect(repository.deactivateActive(vinculo.id)).resolves.toBeUndefined();
    });
  });

  describe('create', () => {
    it('registra o envio como ativo no instante da entrega', async () => {
      const vinculo = await criarVinculo('PIS');

      const criado = await repository.create(vinculo.id, 1);

      const linha = await dataSource.getRepository(DocumentSubmission).findOneBy({ id: criado.id });

      expect(linha?.version).toBe(1);
      expect(linha?.isActive).toBe(true);
      expect(linha?.submittedAt).toBeInstanceOf(Date);
      expect(linha?.deletedAt).toBeNull();
    });
  });
});
