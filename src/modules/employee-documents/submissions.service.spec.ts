import type { EntityManager } from 'typeorm';

import {
  ConcurrentSubmissionError,
  EntityNotFoundError,
  VersionConflictError,
} from '../../shared/errors';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { DocumentSubmission } from './domain/document-submission.entity';
import { EmployeeDocument } from './domain/employee-document.entity';
import { EmployeeDocumentsRepository } from './employee-documents.repository';
import { SubmissionsRepository } from './submissions.repository';
import { SubmissionsService } from './submissions.service';

describe('SubmissionsService', () => {
  /** Identidade que prova que as escritas correram sob a mesma transacao. */
  const manager = { id: 'manager-da-transacao' } as unknown as EntityManager;

  let findNextVersion: jest.Mock;
  let deactivateActive: jest.Mock;
  let create: jest.Mock;
  let findSubmittableById: jest.Mock;
  let service: SubmissionsService;

  const vinculo = { id: 'vinculo-1' } as EmployeeDocument;

  beforeEach(() => {
    findNextVersion = jest.fn().mockResolvedValue(1);
    deactivateActive = jest.fn();
    create = jest.fn();
    const repository = {
      findNextVersion,
      deactivateActive,
      create,
    } as unknown as SubmissionsRepository;

    findSubmittableById = jest.fn().mockResolvedValue(vinculo);
    const employeeDocumentsRepository = {
      findSubmittableById,
    } as unknown as EmployeeDocumentsRepository;

    const transactionRunner = {
      run: (work: (manager: EntityManager) => Promise<unknown>) => work(manager),
    } as unknown as TransactionRunner;

    service = new SubmissionsService(repository, employeeDocumentsRepository, transactionRunner);
  });

  it('registra primeiro envio como versão 1 ativa', async () => {
    const criado = { id: 'envio-1', version: 1, isActive: true } as DocumentSubmission;
    create.mockResolvedValue(criado);

    const resultado = await service.enviar('vinculo-1');

    expect(resultado).toBe(criado);
    expect(create).toHaveBeenCalledWith('vinculo-1', 1, manager);
  });

  it('desativa anterior e incrementa versão', async () => {
    // Vinculo que ja tem envio ativo na versao 1: o proximo e a 2.
    findNextVersion.mockResolvedValue(2);
    const criado = { id: 'envio-2', version: 2, isActive: true } as DocumentSubmission;
    create.mockResolvedValue(criado);

    const resultado = await service.enviar('vinculo-1');

    expect(resultado).toBe(criado);

    // O mesmo `manager` nas tres chamadas e o que prova a atomicidade nesta
    // camada — o rollback em si e coberto na integracao.
    expect(deactivateActive).toHaveBeenCalledWith('vinculo-1', manager);
    expect(findNextVersion).toHaveBeenCalledWith('vinculo-1', manager);
    expect(create).toHaveBeenCalledWith('vinculo-1', 2, manager);

    // Desativar antes de inserir, senao a insercao violaria
    // `uq_submission_active` contra a linha que ela mesma deveria substituir.
    expect(deactivateActive.mock.invocationCallOrder[0]).toBeLessThan(
      create.mock.invocationCallOrder[0],
    );
  });

  it('responde não encontrado para vínculo removido ou inexistente', async () => {
    // Cobre a **ramificacao**, nao a consulta: com o repositorio dublado, este
    // caso passaria igual se `findSubmittableById` nao tivesse JOIN nenhum. Quem
    // prova que colaborador e tipo removidos produzem `null` e o
    // `describe('vinculo invalido')` de `submissions.integration.spec.ts`, contra
    // Postgres real. Os dois sao necessarios e nenhum substitui o outro.
    findSubmittableById.mockResolvedValue(null);

    await expect(service.enviar('inexistente')).rejects.toThrow(EntityNotFoundError);

    expect(create).not.toHaveBeenCalled();
  });

  it('traduz violação de unicidade em conflito de concorrência', async () => {
    // Dois primeiros envios simultaneos: o perdedor viola
    // `uq_submission_active` e receberia 500 cru sem a traducao.
    create.mockRejectedValue(
      Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'uq_submission_active',
      }),
    );

    await expect(service.enviar('vinculo-1')).rejects.toThrow(ConcurrentSubmissionError);
  });

  it('traduz colisão de versão em conflito de versão', async () => {
    // Mesmo SQLSTATE, outra constraint, outro erro (D-14). Colisao em
    // `uq_submission_version` e defeito de calculo — o numero proposto ja esta
    // no historico — e repetir a requisicao nao resolve, ao contrario da
    // corrida por `uq_submission_active`.
    create.mockRejectedValue(
      Object.assign(new Error('duplicate key'), {
        code: '23505',
        constraint: 'uq_submission_version',
      }),
    );

    await expect(service.enviar('vinculo-1')).rejects.toThrow(VersionConflictError);
  });

  it('não engole erro de banco que não seja violação de unicidade', async () => {
    const falha = Object.assign(new Error('conexao perdida'), { code: '08006' });
    create.mockRejectedValue(falha);

    await expect(service.enviar('vinculo-1')).rejects.toThrow(falha);
  });
});
