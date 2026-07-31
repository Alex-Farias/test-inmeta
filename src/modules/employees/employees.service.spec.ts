import type { EntityManager } from 'typeorm';

import { EmployeeDocumentsService } from '../employee-documents/employee-documents.service';
import { DuplicatedResourceError, EntityNotFoundError } from '../../shared/errors';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { Employee } from './domain/employee.entity';
import { EmployeesRepository } from './employees.repository';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  /** Identidade que prova que as duas escritas correram sob a mesma transacao. */
  const manager = { id: 'manager-da-transacao' } as unknown as EntityManager;

  let create: jest.Mock;
  let findActiveByEmail: jest.Mock;
  let findActiveById: jest.Mock;
  let save: jest.Mock;
  let softDelete: jest.Mock;
  let removerVinculosDoColaborador: jest.Mock;
  let service: EmployeesService;

  beforeEach(() => {
    create = jest.fn();
    findActiveByEmail = jest.fn();
    findActiveById = jest.fn();
    save = jest.fn();
    softDelete = jest.fn();
    removerVinculosDoColaborador = jest.fn();
    const repository = {
      create,
      findActiveByEmail,
      findActiveById,
      save,
      softDelete,
    } as unknown as EmployeesRepository;
    const transactionRunner = {
      run: (work: (manager: EntityManager) => Promise<unknown>) => work(manager),
    } as unknown as TransactionRunner;
    const employeeDocumentsService = {
      removerVinculosDoColaborador,
    } as unknown as EmployeeDocumentsService;

    service = new EmployeesService(repository, transactionRunner, employeeDocumentsService);
  });

  it('rejeita e-mail ja usado por colaborador ativo', async () => {
    findActiveByEmail.mockResolvedValue({ id: 'existente' });

    await expect(
      service.create({ name: 'Ana Duplicada', email: 'ana@example.com' }),
    ).rejects.toThrow(DuplicatedResourceError);

    expect(create).not.toHaveBeenCalled();
  });

  it('cadastra colaborador quando o e-mail esta livre', async () => {
    findActiveByEmail.mockResolvedValue(null);
    const criado = { id: 'novo', name: 'Bruno', email: 'bruno@example.com' } as Employee;
    create.mockResolvedValue(criado);

    const resultado = await service.create({ name: 'Bruno', email: 'bruno@example.com' });

    expect(resultado).toBe(criado);
    expect(create).toHaveBeenCalledWith({ name: 'Bruno', email: 'bruno@example.com' });
  });

  it('responde nao encontrado para colaborador removido', async () => {
    findActiveById.mockResolvedValue(null);

    await expect(service.findById('inexistente')).rejects.toThrow(EntityNotFoundError);
    await expect(service.update('inexistente', { name: 'Novo Nome' })).rejects.toThrow(
      EntityNotFoundError,
    );
  });

  it('persiste alteracao de colaborador ativo', async () => {
    const existente = { id: 'ativo', name: 'Ana', email: 'ana@example.com' } as Employee;
    findActiveById.mockResolvedValue(existente);
    findActiveByEmail.mockResolvedValue(null);
    save.mockImplementation((colaborador: Employee) => Promise.resolve(colaborador));

    const resultado = await service.update('ativo', { name: 'Ana Atualizada' });

    expect(resultado.name).toBe('Ana Atualizada');
    expect(resultado.email).toBe('ana@example.com');
    expect(save).toHaveBeenCalledWith(existente);
  });

  it('rejeita update com e-mail ja usado por outro colaborador ativo', async () => {
    const existente = { id: 'ativo', name: 'Ana', email: 'ana@example.com' } as Employee;
    const outro = { id: 'outro', name: 'Carlos', email: 'carlos@example.com' } as Employee;
    findActiveById.mockResolvedValue(existente);
    findActiveByEmail.mockResolvedValue(outro);

    await expect(service.update('ativo', { email: 'carlos@example.com' })).rejects.toThrow(
      DuplicatedResourceError,
    );

    expect(save).not.toHaveBeenCalled();
  });

  it('remove colaborador ativo propagando aos vinculos na mesma transacao', async () => {
    const existente = { id: 'ativo', name: 'Ana', email: 'ana@example.com' } as Employee;
    findActiveById.mockResolvedValue(existente);

    await service.softDelete('ativo');

    // O mesmo `manager` nas duas chamadas e o que prova a atomicidade de
    // REQ-12.4 nesta camada — o rollback em si e coberto na integracao.
    expect(softDelete).toHaveBeenCalledWith('ativo', manager);
    expect(removerVinculosDoColaborador).toHaveBeenCalledWith('ativo', manager);
  });

  it('responde nao encontrado ao remover colaborador ja removido ou inexistente', async () => {
    findActiveById.mockResolvedValue(null);

    await expect(service.softDelete('inexistente')).rejects.toThrow(EntityNotFoundError);

    expect(softDelete).not.toHaveBeenCalled();
    expect(removerVinculosDoColaborador).not.toHaveBeenCalled();
  });
});
