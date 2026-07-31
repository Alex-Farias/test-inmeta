import { ConcurrentSubmissionError } from './concurrent-submission.error';
import { DomainError } from './domain-error';
import { DuplicatedResourceError } from './duplicated-resource.error';
import { VersionConflictError } from './version-conflict.error';

/** `SQLSTATE` de violacao de unicidade no Postgres. */
const UNIQUE_VIOLATION = '23505';

/**
 * A tabela de D-14, em um lugar so.
 *
 * Ela mora aqui, e nao no `catch` de cada service, porque tem **dois**
 * consumidores: o service de submissions, que traduz antes de propagar ao
 * chamador, e o exception filter global, que a usa como rede para qualquer
 * `23505` que chegue sem traducao previa. Duplicar a tabela nos dois pontos
 * significaria que uma constraint nova poderia ser mapeada em um e esquecida no
 * outro — e o sintoma seria um 500 intermitente, dependente do caminho.
 */
const ERRO_POR_CONSTRAINT: Readonly<Record<string, () => DomainError>> = {
  uq_submission_active: () => new ConcurrentSubmissionError(),
  uq_submission_version: () => new VersionConflictError(),
};

/**
 * Default da tabela: unicidade que nao esta declarada acima e dado duplicado
 * comum — e-mail de colaborador, nome de tipo de documento (D-14).
 *
 * E o default que dispensa task de traducao nos modulos de cadastro: eles nao
 * precisam de `catch` proprio, porque o filter os cobre por aqui.
 */
const ERRO_PADRAO = (): DomainError => new DuplicatedResourceError();

interface ErroDeDriver {
  code?: unknown;
  constraint?: unknown;
  driverError?: { code?: unknown; constraint?: unknown };
}

/**
 * Traduz violacao de unicidade do Postgres no erro de dominio correspondente.
 *
 * Devolve `null` quando o erro **nao** e `23505`, e nao um erro generico: o
 * chamador precisa distinguir "traduzi" de "nao e comigo" para repropagar o
 * original intacto. Engolir uma queda de conexao como conflito seria pior que
 * nao traduzir nada.
 *
 * Le `constraint` do proprio erro **e** de `driverError` porque o TypeORM
 * embrulha o erro do `pg` em `QueryFailedError`, e nem toda versao copia os
 * campos do driver para a superficie.
 */
export function traduzirViolacaoDeUnicidade(erro: unknown): DomainError | null {
  if (typeof erro !== 'object' || erro === null) {
    return null;
  }

  const { code, constraint, driverError } = erro as ErroDeDriver;

  if (code !== UNIQUE_VIOLATION && driverError?.code !== UNIQUE_VIOLATION) {
    return null;
  }

  const nome = typeof constraint === 'string' ? constraint : driverError?.constraint;
  const criar = typeof nome === 'string' ? ERRO_POR_CONSTRAINT[nome] : undefined;

  return (criar ?? ERRO_PADRAO)();
}
