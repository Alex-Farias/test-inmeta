import { ArgumentMetadata } from '@nestjs/common';
import { Type } from 'class-transformer';
import { IsDefined, IsInt, IsNotEmpty, IsString, Length, ValidateNested } from 'class-validator';

import { ValidationError } from '../errors';
import { criarValidationPipe } from './validation-pipe.factory';

class EnderecoDto {
  @IsString()
  @Length(8, 8, { message: 'cep deve ter 8 digitos' })
  cep!: string;
}

class ColaboradorDto {
  @IsString()
  @IsNotEmpty()
  nome!: string;

  @IsInt()
  idade!: number;

  @IsDefined()
  @ValidateNested()
  @Type(() => EnderecoDto)
  endereco!: EnderecoDto;
}

const metadata: ArgumentMetadata = { type: 'body', metatype: ColaboradorDto };

const valido = { nome: 'Ana', idade: 30, endereco: { cep: '01310100' } };

async function capturarErro(payload: unknown): Promise<ValidationError> {
  const pipe = criarValidationPipe();

  try {
    await pipe.transform(payload, metadata);
  } catch (erro) {
    return erro as ValidationError;
  }

  throw new Error('esperava que o pipe recusasse a entrada, mas ela passou');
}

describe('ValidationPipe global', () => {
  it('rejeita campo desconhecido nomeando o campo', async () => {
    const erro = await capturarErro({ ...valido, apelido: 'Aninha' });

    // Recusa, e nao remocao silenciosa: e a diferenca entre REQ-19.7 atendido
    // e um 201 que ignorou metade do payload.
    expect(erro).toBeInstanceOf(ValidationError);
    expect(erro.code).toBe('VALIDATION_ERROR');

    const campos = erro.details.map((detalhe) => detalhe.field);
    expect(campos).toContain('apelido');
    expect(erro.details.find((d) => d.field === 'apelido')?.reasons.join(' ')).toMatch(
      /não deve existir|should not exist/i,
    );
  });

  it('nomeia campo aninhado com caminho por ponto', async () => {
    const erro = await capturarErro({ ...valido, endereco: { cep: '123' } });

    // D-08: a arvore do class-validator e achatada em `endereco.cep`.
    expect(erro.details).toEqual([{ field: 'endereco.cep', reasons: ['cep deve ter 8 digitos'] }]);
  });

  it('acumula todos os campos recusados, não só o primeiro', async () => {
    const erro = await capturarErro({ nome: '', idade: 'trinta', apelido: 'x' });

    const campos = erro.details.map((detalhe) => detalhe.field).sort();
    expect(campos).toEqual(['apelido', 'endereco', 'idade', 'nome']);
  });

  it('aceita entrada válida e converte os tipos declarados', async () => {
    const pipe = criarValidationPipe();

    const resultado = (await pipe.transform(
      { nome: 'Ana', idade: '30', endereco: { cep: '01310100' } },
      metadata,
    )) as ColaboradorDto;

    expect(resultado).toBeInstanceOf(ColaboradorDto);
    expect(resultado.idade).toBe(30);
  });
});
