import { DocumentTypesService } from '../document-types/document-types.service';
import { EmployeesService } from '../employees/employees.service';
import { DuplicatedResourceError, EntityNotFoundError } from '../../shared/errors';
import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { EmployeeDocument } from './domain/employee-document.entity';
import { EmployeeDocumentsRepository } from './employee-documents.repository';
import { EmployeeDocumentsService } from './employee-documents.service';

describe('EmployeeDocumentsService', () => {
  let createMany: jest.Mock;
  let findActiveDocumentTypeIds: jest.Mock;
  let findActiveById: jest.Mock;
  let softDelete: jest.Mock;
  let run: jest.Mock;
  let employeesFindById: jest.Mock;
  let documentTypesFindById: jest.Mock;
  let service: EmployeeDocumentsService;

  beforeEach(() => {
    createMany = jest.fn();
    findActiveDocumentTypeIds = jest.fn().mockResolvedValue([]);
    findActiveById = jest.fn();
    softDelete = jest.fn();
    const repository = {
      createMany,
      findActiveDocumentTypeIds,
      findActiveById,
      softDelete,
    } as unknown as EmployeeDocumentsRepository;

    run = jest.fn((work: (manager: undefined) => Promise<unknown>) => work(undefined));
    const transactionRunner = { run } as unknown as TransactionRunner;

    employeesFindById = jest.fn().mockResolvedValue({ id: 'colaborador-1' });
    const employeesService = { findById: employeesFindById } as unknown as EmployeesService;

    documentTypesFindById = jest.fn().mockResolvedValue({ id: 'tipo-a' });
    const documentTypesService = {
      findById: documentTypesFindById,
    } as unknown as DocumentTypesService;

    service = new EmployeeDocumentsService(
      repository,
      transactionRunner,
      employeesService,
      documentTypesService,
    );
  });

  it('cria um vínculo por tipo informado', async () => {
    const vinculos = [
      { id: '1', employeeId: 'colaborador-1', documentTypeId: 'tipo-a' },
      { id: '2', employeeId: 'colaborador-1', documentTypeId: 'tipo-b' },
    ] as EmployeeDocument[];
    createMany.mockResolvedValue(vinculos);

    const resultado = await service.vincular({
      employeeId: 'colaborador-1',
      documentTypeIds: ['tipo-a', 'tipo-b'],
    });

    expect(resultado).toBe(vinculos);
    expect(createMany).toHaveBeenCalledWith('colaborador-1', ['tipo-a', 'tipo-b'], undefined);
    expect(run).toHaveBeenCalledTimes(1);
  });

  it('rejeita lote inteiro com tipo removido', async () => {
    documentTypesFindById.mockRejectedValue(
      new EntityNotFoundError('Tipo de documento nao encontrado.'),
    );

    await expect(
      service.vincular({ employeeId: 'colaborador-1', documentTypeIds: ['tipo-a', 'removido'] }),
    ).rejects.toThrow(EntityNotFoundError);

    expect(createMany).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('rejeita lote inteiro com colaborador removido ou inexistente', async () => {
    employeesFindById.mockRejectedValue(new EntityNotFoundError('Colaborador nao encontrado.'));

    await expect(
      service.vincular({ employeeId: 'removido', documentTypeIds: ['tipo-a'] }),
    ).rejects.toThrow(EntityNotFoundError);

    expect(documentTypesFindById).not.toHaveBeenCalled();
    expect(createMany).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('rejeita lote com vínculo ativo duplicado', async () => {
    findActiveDocumentTypeIds.mockResolvedValue(['tipo-a']);

    await expect(
      service.vincular({ employeeId: 'colaborador-1', documentTypeIds: ['tipo-a', 'tipo-b'] }),
    ).rejects.toThrow(DuplicatedResourceError);

    expect(createMany).not.toHaveBeenCalled();
    expect(run).not.toHaveBeenCalled();
  });

  it('responde não encontrado para vínculo já removido', async () => {
    findActiveById.mockResolvedValue(null);

    await expect(service.desvincular('inexistente')).rejects.toThrow(EntityNotFoundError);

    expect(softDelete).not.toHaveBeenCalled();
  });

  it('grava causa MANUAL ao desvincular vínculo ativo', async () => {
    findActiveById.mockResolvedValue({ id: 'vinculo-1' });

    await service.desvincular('vinculo-1');

    expect(softDelete).toHaveBeenCalledWith('vinculo-1', 'MANUAL');
  });
});
