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
import { EmployeeDocumentsRepository } from './employee-documents.repository';

describe('EmployeeDocumentsRepository (integration)', () => {
  let container: StartedPostgreSqlContainer;
  let dataSource: DataSource;
  let repository: EmployeeDocumentsRepository;

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
    repository = new EmployeeDocumentsRepository(dataSource);
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
    it('rejeita vínculo removido sem causa de remoção', async () => {
      const employee = await dataSource
        .getRepository(Employee)
        .save(dataSource.getRepository(Employee).create({ name: 'Ana', email: 'ana@example.com' }));
      const documentType = await dataSource
        .getRepository(DocumentType)
        .save(dataSource.getRepository(DocumentType).create({ name: 'CPF' }));

      await expect(
        dataSource.query(
          `INSERT INTO employee_documents (employee_id, document_type_id, deleted_at, deletion_cause)
           VALUES ($1, $2, now(), NULL)`,
          [employee.id, documentType.id],
        ),
      ).rejects.toThrow();
    });
  });

  describe('desvincular', () => {
    it('grava causa MANUAL na desvinculação', async () => {
      const employee = await dataSource
        .getRepository(Employee)
        .save(dataSource.getRepository(Employee).create({ name: 'Ana', email: 'ana@example.com' }));
      const documentType = await dataSource
        .getRepository(DocumentType)
        .save(dataSource.getRepository(DocumentType).create({ name: 'CPF' }));
      const [vinculo] = await repository.createMany(employee.id, [documentType.id]);

      await repository.softDelete(vinculo.id, 'MANUAL');

      const linha = await dataSource
        .getRepository(EmployeeDocument)
        .findOne({ where: { id: vinculo.id }, withDeleted: true });

      expect(linha?.deletedAt).not.toBeNull();
      expect(linha?.deletionCause).toBe('MANUAL');
    });
  });

  describe('re-vínculo', () => {
    it('cria vínculo novo após desvinculação', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));

      const [anterior] = await repository.createMany(ana.id, [cpf.id]);
      await repository.softDelete(anterior.id, 'MANUAL');

      // `uq_employee_document_active` e parcial: a linha removida deixa de
      // ocupar o slot de unicidade, entao o mesmo par insere de novo (D-07).
      const [novo] = await repository.createMany(ana.id, [cpf.id]);

      expect(novo.id).not.toBe(anterior.id);

      // O vinculo anterior nao foi ressuscitado — sao duas linhas distintas,
      // que e o que separa D-07 da alternativa de limpar `deleted_at`.
      const linhas = await dataSource
        .getRepository(EmployeeDocument)
        .find({ withDeleted: true, where: { employeeId: ana.id, documentTypeId: cpf.id } });
      expect(linhas).toHaveLength(2);

      const porId = new Map(linhas.map((linha) => [linha.id, linha]));
      expect(porId.get(anterior.id)?.deletedAt).not.toBeNull();
      expect(porId.get(anterior.id)?.deletionCause).toBe('MANUAL');
      expect(porId.get(novo.id)?.deletedAt).toBeNull();
      expect(porId.get(novo.id)?.deletionCause).toBeNull();
    });
  });

  describe('softDeleteAllByEmployeeId', () => {
    it('remove todos os vínculos ativos do colaborador', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const bruno = await employees.save(
        employees.create({ name: 'Bruno', email: 'bruno@example.com' }),
      );
      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      const rg = await documentTypes.save(documentTypes.create({ name: 'RG' }));

      const [anaCpf, anaRg] = await repository.createMany(ana.id, [cpf.id, rg.id]);
      const [brunoCpf] = await repository.createMany(bruno.id, [cpf.id]);

      await repository.softDeleteAllByEmployeeId(ana.id, 'EMPLOYEE_REMOVED');

      const linhas = await dataSource
        .getRepository(EmployeeDocument)
        .find({ withDeleted: true, order: { createdAt: 'ASC' } });
      const porId = new Map(linhas.map((linha) => [linha.id, linha]));

      for (const id of [anaCpf.id, anaRg.id]) {
        expect(porId.get(id)?.deletedAt).not.toBeNull();
        expect(porId.get(id)?.deletionCause).toBe('EMPLOYEE_REMOVED');
      }

      // Isolamento: o criterio filtra por colaborador, nao remove a tabela toda.
      expect(porId.get(brunoCpf.id)?.deletedAt).toBeNull();
      expect(porId.get(brunoCpf.id)?.deletionCause).toBeNull();
    });

    it('preserva a causa de vínculo já desvinculado manualmente', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      const rg = await documentTypes.save(documentTypes.create({ name: 'RG' }));

      const [anaCpf, anaRg] = await repository.createMany(ana.id, [cpf.id, rg.id]);
      await repository.softDelete(anaCpf.id, 'MANUAL');

      await repository.softDeleteAllByEmployeeId(ana.id, 'EMPLOYEE_REMOVED');

      const linhas = await dataSource.getRepository(EmployeeDocument).find({ withDeleted: true });
      const porId = new Map(linhas.map((linha) => [linha.id, linha]));

      // `deletedAt: IsNull()` no criterio: a cascata nao reescreve o que ja
      // estava removido, senao a distincao de D-12 se perderia.
      expect(porId.get(anaCpf.id)?.deletionCause).toBe('MANUAL');
      expect(porId.get(anaRg.id)?.deletionCause).toBe('EMPLOYEE_REMOVED');
    });
  });

  describe('softDeleteAllByDocumentTypeId', () => {
    it('grava causa TYPE_REMOVED na cascata', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const bruno = await employees.save(
        employees.create({ name: 'Bruno', email: 'bruno@example.com' }),
      );
      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      const rg = await documentTypes.save(documentTypes.create({ name: 'RG' }));

      // O mesmo tipo alcanca vinculos de colaboradores diferentes — e o que
      // distingue esta cascata da de colaborador.
      const [anaCpf, anaRg] = await repository.createMany(ana.id, [cpf.id, rg.id]);
      const [brunoCpf] = await repository.createMany(bruno.id, [cpf.id]);

      await repository.softDeleteAllByDocumentTypeId(cpf.id, 'TYPE_REMOVED');

      const linhas = await dataSource.getRepository(EmployeeDocument).find({ withDeleted: true });
      const porId = new Map(linhas.map((linha) => [linha.id, linha]));

      for (const id of [anaCpf.id, brunoCpf.id]) {
        expect(porId.get(id)?.deletedAt).not.toBeNull();
        expect(porId.get(id)?.deletionCause).toBe('TYPE_REMOVED');
      }

      // Isolamento: o vinculo do outro tipo nao e alcancado.
      expect(porId.get(anaRg.id)?.deletedAt).toBeNull();
      expect(porId.get(anaRg.id)?.deletionCause).toBeNull();
    });

    it('preserva a causa de vínculo já desvinculado manualmente', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);

      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const bruno = await employees.save(
        employees.create({ name: 'Bruno', email: 'bruno@example.com' }),
      );
      const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));

      const [anaCpf] = await repository.createMany(ana.id, [cpf.id]);
      const [brunoCpf] = await repository.createMany(bruno.id, [cpf.id]);
      await repository.softDelete(anaCpf.id, 'MANUAL');

      await repository.softDeleteAllByDocumentTypeId(cpf.id, 'TYPE_REMOVED');

      const linhas = await dataSource.getRepository(EmployeeDocument).find({ withDeleted: true });
      const porId = new Map(linhas.map((linha) => [linha.id, linha]));

      // Mesma guarda do `deletedAt: IsNull()` provada pelo outro gatilho: a
      // cascata nao reprocessa linha ja removida.
      expect(porId.get(anaCpf.id)?.deletionCause).toBe('MANUAL');
      expect(porId.get(brunoCpf.id)?.deletionCause).toBe('TYPE_REMOVED');
    });
  });

  describe('findPending', () => {
    it('exclui vínculo com envio ativo', async () => {
      const employees = dataSource.getRepository(Employee);
      const documentTypes = dataSource.getRepository(DocumentType);
      const submissions = dataSource.getRepository(DocumentSubmission);

      const ana = await employees.save(employees.create({ name: 'Ana', email: 'ana@example.com' }));
      const semHistorico = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
      const comHistoricoRemovido = await documentTypes.save(documentTypes.create({ name: 'RG' }));
      const comEnvioAtivo = await documentTypes.save(documentTypes.create({ name: 'CTPS' }));

      const [vinculoSemHistorico] = await repository.createMany(ana.id, [semHistorico.id]);
      const [vinculoComHistoricoRemovido] = await repository.createMany(ana.id, [
        comHistoricoRemovido.id,
      ]);
      const [vinculoComEnvioAtivo] = await repository.createMany(ana.id, [comEnvioAtivo.id]);

      // Pendente com historico (D-13, nota da TASK-047): envio existiu e foi
      // desativado, mas nenhum envio ativo restou — ainda e pendente. Falsifica
      // um `NOT EXISTS` que esquecesse o `is_active`.
      await submissions.save(
        submissions.create({
          employeeDocumentId: vinculoComHistoricoRemovido.id,
          version: 1,
          isActive: false,
          submittedAt: new Date(),
        }),
      );

      await submissions.save(
        submissions.create({
          employeeDocumentId: vinculoComEnvioAtivo.id,
          version: 1,
          isActive: true,
          submittedAt: new Date(),
        }),
      );

      const pagina = await repository.findPending({ page: 1, limit: 20 });

      expect(pagina.total).toBe(2);
      const idsPendentes = pagina.items.map((item) => item.id).sort();
      expect(idsPendentes).toEqual([vinculoSemHistorico.id, vinculoComHistoricoRemovido.id].sort());

      const item = pagina.items.find((i) => i.id === vinculoSemHistorico.id);
      expect(item?.employee).toEqual({ id: ana.id, name: 'Ana' });
      expect(item?.documentType).toEqual({ id: semHistorico.id, name: 'CPF' });
    });

    /**
     * Uma unica descricao no `tasks.md` ("aplica filtros cumulativamente"), mas
     * REQ-10.2 e REQ-10.3 pedem que cada filtro funcione tambem isolado — um
     * teste so com os dois juntos passaria igual se um dos dois filtros
     * estivesse quebrado. Tres `it()`, mesmo padrao de expansao das TASK-028/030.
     */
    describe('filtros', () => {
      async function montarCenario() {
        const employees = dataSource.getRepository(Employee);
        const documentTypes = dataSource.getRepository(DocumentType);

        const ana = await employees.save(
          employees.create({ name: 'Ana', email: 'ana-filtro@example.com' }),
        );
        const bruno = await employees.save(
          employees.create({ name: 'Bruno', email: 'bruno-filtro@example.com' }),
        );
        const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
        const rg = await documentTypes.save(documentTypes.create({ name: 'RG' }));

        const [anaCpf] = await repository.createMany(ana.id, [cpf.id]);
        const [anaRg] = await repository.createMany(ana.id, [rg.id]);
        const [brunoCpf] = await repository.createMany(bruno.id, [cpf.id]);
        const [brunoRg] = await repository.createMany(bruno.id, [rg.id]);

        return { ana, bruno, cpf, rg, anaCpf, anaRg, brunoCpf, brunoRg };
      }

      it('filtra por colaborador', async () => {
        const { ana, anaCpf, anaRg } = await montarCenario();

        const pagina = await repository.findPending({ page: 1, limit: 20 }, { employeeId: ana.id });

        expect(pagina.total).toBe(2);
        expect(pagina.items.map((item) => item.id).sort()).toEqual([anaCpf.id, anaRg.id].sort());
      });

      it('filtra por tipo', async () => {
        const { cpf, anaCpf, brunoCpf } = await montarCenario();

        const pagina = await repository.findPending(
          { page: 1, limit: 20 },
          { documentTypeId: cpf.id },
        );

        expect(pagina.total).toBe(2);
        expect(pagina.items.map((item) => item.id).sort()).toEqual([anaCpf.id, brunoCpf.id].sort());
      });

      it('aplica filtros cumulativamente', async () => {
        const { ana, cpf, anaCpf } = await montarCenario();

        const pagina = await repository.findPending(
          { page: 1, limit: 20 },
          { employeeId: ana.id, documentTypeId: cpf.id },
        );

        expect(pagina.total).toBe(1);
        expect(pagina.items.map((item) => item.id)).toEqual([anaCpf.id]);
      });
    });

    /**
     * REQ-10.7. Sem codigo de producao dedicado — a mesma query da TASK-049 ja
     * garante isso por construcao (nota da TASK-050 em `tasks.md`). O colaborador
     * e removido **direto pelo `DataSource`**, sem passar pela cascata da
     * TASK-032, para isolar a defesa do `innerJoin` (D-06) da defesa da cascata —
     * mesma tecnica de `submissions.integration.spec.ts` (TASK-043/045).
     */
    describe('filtro para registro removido ou inexistente', () => {
      it('devolve vazio para filtro com colaborador removido', async () => {
        const employees = dataSource.getRepository(Employee);
        const documentTypes = dataSource.getRepository(DocumentType);

        const ana = await employees.save(
          employees.create({ name: 'Ana', email: 'ana-removida@example.com' }),
        );
        const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
        await repository.createMany(ana.id, [cpf.id]);

        // Remove o colaborador sem passar pela cascata (TASK-032): o vinculo
        // continua sem marcacao propria, e quem precisa excluir e o JOIN.
        await dataSource.getRepository(Employee).softDelete({ id: ana.id });

        const pagina = await repository.findPending({ page: 1, limit: 20 }, { employeeId: ana.id });

        expect(pagina.total).toBe(0);
        expect(pagina.items).toEqual([]);
      });

      it('devolve vazio para filtro com id inexistente', async () => {
        const pagina = await repository.findPending(
          { page: 1, limit: 20 },
          { employeeId: '00000000-0000-4000-8000-000000000000' },
        );

        expect(pagina.total).toBe(0);
        expect(pagina.items).toEqual([]);
      });
    });

    /**
     * REQ-14.3, REQ-14.4 (TASK-052). Sem filtro nenhum — e a listagem geral,
     * irma do bloco de filtro da TASK-050 acima. Mesma tecnica: remove o
     * colaborador/tipo **direto pelo `DataSource`**, sem passar pela cascata de
     * TASK-032/034, para provar que quem exclui e o `innerJoin` com
     * `deleted_at IS NULL` (D-06) e nao a marcacao do proprio vinculo.
     */
    describe('exclusao por colaborador ou tipo removido', () => {
      it('exclui pendente de colaborador removido', async () => {
        const employees = dataSource.getRepository(Employee);
        const documentTypes = dataSource.getRepository(DocumentType);

        const ana = await employees.save(
          employees.create({ name: 'Ana', email: 'ana-pendente-removida@example.com' }),
        );
        const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF' }));
        const [vinculo] = await repository.createMany(ana.id, [cpf.id]);

        await dataSource.getRepository(Employee).softDelete({ id: ana.id });

        const pagina = await repository.findPending({ page: 1, limit: 20 });

        expect(pagina.items.map((item) => item.id)).not.toContain(vinculo.id);
      });

      // Espelho do teste acima para REQ-14.4 — o nome declarado em `tasks.md`
      // cobre só o lado do colaborador, mesmo padrao de expansao simetrica das
      // TASK-031/033.
      it('exclui pendente de tipo removido', async () => {
        const employees = dataSource.getRepository(Employee);
        const documentTypes = dataSource.getRepository(DocumentType);

        const ana = await employees.save(
          employees.create({ name: 'Ana', email: 'ana-tipo-removido@example.com' }),
        );
        const cpf = await documentTypes.save(documentTypes.create({ name: 'CPF-tipo-removido' }));
        const [vinculo] = await repository.createMany(ana.id, [cpf.id]);

        await dataSource.getRepository(DocumentType).softDelete({ id: cpf.id });

        const pagina = await repository.findPending({ page: 1, limit: 20 });

        expect(pagina.items.map((item) => item.id)).not.toContain(vinculo.id);
      });
    });
  });
});
