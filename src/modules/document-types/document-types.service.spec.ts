import type { EntityManager } from 'typeorm';

import { EmployeeDocumentsService } from '../employee-documents/employee-documents.service';
import { DuplicatedResourceError, EntityNotFoundError } from '../../shared/errors';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { DocumentType } from './domain/document-type.entity';
import { DocumentTypesRepository } from './document-types.repository';
import { DocumentTypesService } from './document-types.service';

describe('DocumentTypesService', () => {
  /** Identidade que prova que as duas escritas correram sob a mesma transacao. */
  const manager = { id: 'manager-da-transacao' } as unknown as EntityManager;

  let create: jest.Mock;
  let findActiveByName: jest.Mock;
  let findActiveById: jest.Mock;
  let softDelete: jest.Mock;
  let removerVinculosDoTipo: jest.Mock;
  let service: DocumentTypesService;

  beforeEach(() => {
    create = jest.fn();
    findActiveByName = jest.fn();
    findActiveById = jest.fn();
    softDelete = jest.fn();
    removerVinculosDoTipo = jest.fn();
    const repository = {
      create,
      findActiveByName,
      findActiveById,
      softDelete,
    } as unknown as DocumentTypesRepository;
    const transactionRunner = {
      run: (work: (manager: EntityManager) => Promise<unknown>) => work(manager),
    } as unknown as TransactionRunner;
    const employeeDocumentsService = {
      removerVinculosDoTipo,
    } as unknown as EmployeeDocumentsService;

    service = new DocumentTypesService(repository, transactionRunner, employeeDocumentsService);
  });

  it('rejeita nome ja usado por tipo ativo', async () => {
    findActiveByName.mockResolvedValue({ id: 'existente' });

    await expect(service.create({ name: 'CPF' })).rejects.toThrow(DuplicatedResourceError);

    expect(create).not.toHaveBeenCalled();
  });

  it('cadastra tipo quando o nome esta livre', async () => {
    findActiveByName.mockResolvedValue(null);
    const criado = { id: 'novo', name: 'ASO', description: null } as DocumentType;
    create.mockResolvedValue(criado);

    const resultado = await service.create({ name: 'ASO', description: 'Atestado' });

    expect(resultado).toBe(criado);
    expect(create).toHaveBeenCalledWith({ name: 'ASO', description: 'Atestado' });
  });

  it('responde nao encontrado para tipo removido', async () => {
    findActiveById.mockResolvedValue(null);

    await expect(service.findById('inexistente')).rejects.toThrow(EntityNotFoundError);
  });

  it('remove tipo ativo propagando aos vinculos na mesma transacao', async () => {
    const existente = { id: 'ativo', name: 'CPF', description: null } as DocumentType;
    findActiveById.mockResolvedValue(existente);

    await service.softDelete('ativo');

    // O mesmo `manager` nas duas chamadas e o que prova a atomicidade de
    // REQ-13.4 nesta camada — o rollback em si e coberto na integracao.
    expect(softDelete).toHaveBeenCalledWith('ativo', manager);
    expect(removerVinculosDoTipo).toHaveBeenCalledWith('ativo', manager);
  });

  it('responde nao encontrado ao remover tipo ja removido ou inexistente', async () => {
    findActiveById.mockResolvedValue(null);

    await expect(service.softDelete('inexistente')).rejects.toThrow(EntityNotFoundError);

    expect(softDelete).not.toHaveBeenCalled();
    expect(removerVinculosDoTipo).not.toHaveBeenCalled();
  });
});
