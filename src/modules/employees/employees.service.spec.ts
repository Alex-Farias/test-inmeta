import { DuplicatedResourceError } from '../../shared/errors';
import { Employee } from './domain/employee.entity';
import { EmployeesRepository } from './employees.repository';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  let create: jest.Mock;
  let findActiveByEmail: jest.Mock;
  let service: EmployeesService;

  beforeEach(() => {
    create = jest.fn();
    findActiveByEmail = jest.fn();
    const repository = { create, findActiveByEmail } as unknown as EmployeesRepository;

    service = new EmployeesService(repository);
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
});
