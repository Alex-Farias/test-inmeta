import { DuplicatedResourceError, EntityNotFoundError } from '../../shared/errors';
import { DocumentType } from './domain/document-type.entity';
import { DocumentTypesRepository } from './document-types.repository';
import { DocumentTypesService } from './document-types.service';

describe('DocumentTypesService', () => {
  let create: jest.Mock;
  let findActiveByName: jest.Mock;
  let findActiveById: jest.Mock;
  let service: DocumentTypesService;

  beforeEach(() => {
    create = jest.fn();
    findActiveByName = jest.fn();
    findActiveById = jest.fn();
    const repository = {
      create,
      findActiveByName,
      findActiveById,
    } as unknown as DocumentTypesRepository;

    service = new DocumentTypesService(repository);
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
});
