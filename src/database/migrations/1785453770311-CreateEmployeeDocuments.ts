import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Terceira migration de dominio (TASK-025). Escrita a mao, nao gerada por
 * `migration:generate` — indice unico parcial e CHECK exigem SQL manual (D-11).
 */
export class CreateEmployeeDocuments1785453770311 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE employee_documents (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_id uuid NOT NULL REFERENCES employees(id),
        document_type_id uuid NOT NULL REFERENCES document_types(id),
        deletion_cause varchar(20) NULL,
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL
      )
    `);

    // Unico entre ativos (design.md §1.3): reforca REQ-03.6 e viabiliza REQ-05,
    // pois um par ja desvinculado deixa de contar no indice e um novo vinculo
    // pode ser inserido.
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_employee_document_active
        ON employee_documents (employee_id, document_type_id) WHERE deleted_at IS NULL
    `);

    // Suporte a REQ-17 (estatistica por tipo) sem carregar colecao em memoria.
    await queryRunner.query(`
      CREATE INDEX idx_employee_documents_type
        ON employee_documents (document_type_id) WHERE deleted_at IS NULL
    `);

    // D-12: a causa da remocao so existe quando ha remocao, e toda remocao
    // carrega uma causa. Elimina por DDL o estado em que uma existe sem a outra.
    await queryRunner.query(`
      ALTER TABLE employee_documents ADD CONSTRAINT ck_employee_documents_deletion_cause
        CHECK ((deleted_at IS NULL) = (deletion_cause IS NULL))
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE employee_documents');
  }
}
