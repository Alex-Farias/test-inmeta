import { TransactionRunner } from '../../shared/transaction/transaction-runner';
import { EmployeeDocument } from './domain/employee-document.entity';
import { EmployeeDocumentsRepository } from './employee-documents.repository';
import { EmployeeDocumentsService } from './employee-documents.service';

describe('EmployeeDocumentsService', () => {
  let createMany: jest.Mock;
  let run: jest.Mock;
  let service: EmployeeDocumentsService;

  beforeEach(() => {
    createMany = jest.fn();
    const repository = { createMany } as unknown as EmployeeDocumentsRepository;

    run = jest.fn((work: (manager: undefined) => Promise<unknown>) => work(undefined));
    const transactionRunner = { run } as unknown as TransactionRunner;

    service = new EmployeeDocumentsService(repository, transactionRunner);
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
});
