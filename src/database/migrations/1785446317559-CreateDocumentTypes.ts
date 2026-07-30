import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Segunda migration de dominio (TASK-020). Escrita a mao, nao gerada por
 * `migration:generate` — indice unico parcial exige SQL manual (D-11).
 */
export class CreateDocumentTypes1785446317559 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE document_types (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        name varchar(100) NOT NULL,
        description text NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL
      )
    `);

    // Unico entre ativos (design.md §1.3): remover um tipo libera o nome
    // para novo cadastro (REQ-02.3, REQ-13.6) sem sair do banco.
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_document_types_name
        ON document_types (name) WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE document_types');
  }
}
