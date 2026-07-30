import { DuplicatedResourceError, EntityNotFoundError } from '../../shared/errors';
import { Employee } from './domain/employee.entity';
import { EmployeesRepository } from './employees.repository';
import { EmployeesService } from './employees.service';

describe('EmployeesService', () => {
  let create: jest.Mock;
  let findActiveByEmail: jest.Mock;
  let findActiveById: jest.Mock;
  let save: jest.Mock;
  let softDelete: jest.Mock;
  let service: EmployeesService;

  beforeEach(() => {
    create = jest.fn();
    findActiveByEmail = jest.fn();
    findActiveById = jest.fn();
    save = jest.fn();
    softDelete = jest.fn();
    const repository = {
      create,
      findActiveByEmail,
      findActiveById,
      save,
      softDelete,
    } as unknown as EmployeesRepository;

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

  it('remove colaborador ativo', async () => {
    const existente = { id: 'ativo', name: 'Ana', email: 'ana@example.com' } as Employee;
    findActiveById.mockResolvedValue(existente);

    await service.softDelete('ativo');

    expect(softDelete).toHaveBeenCalledWith('ativo');
  });

  it('responde nao encontrado ao remover colaborador ja removido ou inexistente', async () => {
    findActiveById.mockResolvedValue(null);

    await expect(service.softDelete('inexistente')).rejects.toThrow(EntityNotFoundError);

    expect(softDelete).not.toHaveBeenCalled();
  });
});
