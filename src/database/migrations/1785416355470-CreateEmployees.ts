import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Primeira migration de dominio (TASK-012). Escrita a mao, nao gerada por
 * `migration:generate` — indice unico parcial exige SQL manual (D-11).
 */
export class CreateEmployees1785416355470 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE employees (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(150) NOT NULL,
        email varchar(255) NOT NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL
      )
    `);

    // Unico entre ativos (design.md §1.3): remover um colaborador libera o
    // e-mail para novo cadastro (REQ-01.3, REQ-12.5) sem sair do banco.
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_employees_email
        ON employees (email) WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE employees');
  }
}
