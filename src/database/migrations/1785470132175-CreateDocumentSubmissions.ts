import { MigrationInterface, QueryRunner } from 'typeorm';

/**
 * Quarta e ultima migration de dominio (TASK-037). Escrita a mao, nao gerada
 * por `migration:generate` — indices parciais exigem SQL manual (D-11).
 */
export class CreateDocumentSubmissions1785470132175 implements MigrationInterface {
  public async up(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query(`
      CREATE TABLE document_submissions (
        id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
        employee_document_id uuid NOT NULL REFERENCES employee_documents(id),
        version integer NOT NULL,
        is_active boolean NOT NULL DEFAULT true,
        submitted_at timestamptz NOT NULL DEFAULT now(),
        created_at timestamptz NOT NULL DEFAULT now(),
        updated_at timestamptz NOT NULL DEFAULT now(),
        deleted_at timestamptz NULL
      )
    `);

    // Base de REQ-07.3 e REQ-07.5 (D-02): a garantia de "no maximo um envio
    // ativo por vinculo" vive no schema, nao em lock nem em fila. Reenvio
    // concorrente vira 23505, traduzido em 409.
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_submission_active
        ON document_submissions (employee_document_id)
        WHERE is_active AND deleted_at IS NULL
    `);

    // Deliberadamente NAO parcial, ao contrario dos demais indices unicos do
    // projeto. Se ignorasse linhas removidas, a versao 3 de um envio removido
    // poderia ser reemitida e o historico teria dois registros diferentes
    // chamados "versao 3". REQ-08.4 exige o oposto: o contador nao reinicia e
    // numero ja emitido nao e reaproveitado. Manter o indice sobre todas as
    // linhas e o que garante isso no banco, e nao por disciplina de codigo.
    await queryRunner.query(`
      CREATE UNIQUE INDEX uq_submission_version
        ON document_submissions (employee_document_id, version)
    `);

    // Suporte a REQ-18 (ultimos envios), com desempate deterministico por id
    // (D-15) — sem ele, dois envios de mesmo instante trocariam de posicao
    // entre paginas.
    await queryRunner.query(`
      CREATE INDEX idx_submissions_recent
        ON document_submissions (submitted_at DESC, id DESC)
        WHERE deleted_at IS NULL
    `);
  }

  public async down(queryRunner: QueryRunner): Promise<void> {
    await queryRunner.query('DROP TABLE document_submissions');
  }
}
