import { plainToInstance } from 'class-transformer';
import { IsEnum, IsInt, IsNotEmpty, IsString, Max, Min, validateSync } from 'class-validator';

export enum Environment {
  Development = 'development',
  Test = 'test',
  Production = 'production',
}

/**
 * Contrato das variaveis de ambiente. REQ-00.3 exige falha imediata na
 * inicializacao, identificando o item faltante — o custo de nao fazer isso e
 * um erro de conexao adiante, que nao diz que a causa foi configuracao.
 */
export class EnvironmentVariables {
  @IsEnum(Environment, {
    message: `NODE_ENV deve ser um de: ${Object.values(Environment).join(', ')}`,
  })
  NODE_ENV!: Environment;

  @IsInt({ message: 'PORT deve ser um numero inteiro' })
  @Min(1)
  @Max(65535)
  PORT!: number;

  @IsString()
  @IsNotEmpty({ message: 'DB_HOST e obrigatorio' })
  DB_HOST!: string;

  @IsInt({ message: 'DB_PORT deve ser um numero inteiro' })
  @Min(1)
  @Max(65535)
  DB_PORT!: number;

  @IsString()
  @IsNotEmpty({ message: 'DB_USER e obrigatorio' })
  DB_USER!: string;

  @IsString()
  @IsNotEmpty({ message: 'DB_PASSWORD e obrigatorio' })
  DB_PASSWORD!: string;

  @IsString()
  @IsNotEmpty({ message: 'DB_NAME e obrigatorio' })
  DB_NAME!: string;
}

/**
 * Consumida pela opcao `validate` do ConfigModule. Lanca — nao retorna erro —
 * porque o unico desfecho aceitavel para configuracao invalida e o processo
 * nao subir.
 */
export function validateEnv(config: Record<string, unknown>): EnvironmentVariables {
  const validated = plainToInstance(EnvironmentVariables, config, {
    enableImplicitConversion: true,
  });

  const errors = validateSync(validated, { skipMissingProperties: false });

  if (errors.length > 0) {
    // Uma linha por variavel recusada, com o nome dela. Despejar o objeto de
    // erro inteiro obrigaria quem esta subindo o servico a garimpar o nome.
    const detalhes = errors
      .map((error) => {
        const motivos = Object.values(error.constraints ?? {}).join('; ');
        return `  - ${error.property}: ${motivos || 'valor invalido'}`;
      })
      .join('\n');

    throw new Error(
      `Configuracao invalida. Corrija as variaveis abaixo antes de subir o servico ` +
        `(ver .env.example):\n${detalhes}`,
    );
  }

  return validated;
}
