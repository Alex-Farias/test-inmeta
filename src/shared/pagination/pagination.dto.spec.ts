import { ArgumentMetadata } from '@nestjs/common';

import { ValidationError } from '../errors';
import { criarValidationPipe } from '../pipes/validation-pipe.factory';
import { PaginationQueryDto } from './pagination-query.dto';

const metadata: ArgumentMetadata = { type: 'query', metatype: PaginationQueryDto };

describe('PaginationQueryDto', () => {
  it('aplica padrão, limita ao teto e rejeita valor inválido', async () => {
    const pipe = criarValidationPipe();

    const semParametros = (await pipe.transform({}, metadata)) as PaginationQueryDto;
    expect(semParametros.page).toBe(1);
    expect(semParametros.limit).toBe(20);

    const acimaDoTeto = (await pipe.transform({ limit: '500' }, metadata)) as PaginationQueryDto;
    expect(acimaDoTeto.limit).toBe(100);

    await expect(pipe.transform({ page: '-1' }, metadata)).rejects.toBeInstanceOf(ValidationError);
    await expect(pipe.transform({ limit: 'abc' }, metadata)).rejects.toBeInstanceOf(
      ValidationError,
    );
  });

  it('aceita page e limit dentro do teto sem alterar o valor pedido', async () => {
    const pipe = criarValidationPipe();

    const resultado = (await pipe.transform(
      { page: '3', limit: '50' },
      metadata,
    )) as PaginationQueryDto;

    expect(resultado.page).toBe(3);
    expect(resultado.limit).toBe(50);
  });

  it('rejeita limit zero, nomeando o campo', async () => {
    const pipe = criarValidationPipe();

    try {
      await pipe.transform({ limit: '0' }, metadata);
      throw new Error('esperava que o pipe recusasse limit=0, mas ele passou');
    } catch (erro) {
      expect(erro).toBeInstanceOf(ValidationError);
      expect((erro as ValidationError).details.map((d) => d.field)).toContain('limit');
    }
  });
});
