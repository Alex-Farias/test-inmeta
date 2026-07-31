import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

export interface ConformidadeGlobal {
  employeesFullyCompliantPercentage: number;
  documentsSubmittedPercentage: number;
}

interface LinhaDeConformidade {
  documents_submitted_percentage: string | null;
  employees_fully_compliant_percentage: string | null;
}

/**
 * Exceção declarada de D-10: acessa o schema diretamente por SQL, sem
 * repositório TypeORM nem entidade própria — compor a partir dos services de
 * outros módulos exigiria carregar coleção para reduzir em memória, que é
 * exatamente o que REQ-16.7 proíbe (2.1 do design).
 */
@Injectable()
export class StatisticsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /**
   * As duas leituras de D-09 num único round-trip. `vinculo` é vínculo ativo
   * de colaborador ativo e tipo ativo (os três `JOIN ... AND deleted_at IS
   * NULL` são D-06 — join manual não recebe o filtro automático do
   * `@DeleteDateColumn`), com `entregue` via `EXISTS` contra submission ativa.
   * `documents_submitted_percentage` agrega direto sobre `vinculo`;
   * `employees_fully_compliant_percentage` agrupa por colaborador
   * (`bool_and(entregue)`) numa CTE separada e agrega por subquery escalar.
   *
   * `NULLIF` nas duas divisões: sem base a expressão retorna `NULL`, não
   * lança "division by zero" — é como D-09 já está escrita, não é a prova de
   * REQ-16.6 (essa fica para a TASK-055).
   */
  async calcularConformidadeGlobal(manager?: EntityManager): Promise<ConformidadeGlobal> {
    const executor = manager ?? this.dataSource;

    const linhas = await executor.query<LinhaDeConformidade[]>(`
      WITH vinculo AS (
        SELECT
          ed.id,
          ed.employee_id,
          EXISTS (
            SELECT 1 FROM document_submissions s
            WHERE s.employee_document_id = ed.id
              AND s.is_active
              AND s.deleted_at IS NULL
          ) AS entregue
        FROM employee_documents ed
        JOIN employees      e  ON e.id  = ed.employee_id      AND e.deleted_at  IS NULL
        JOIN document_types dt ON dt.id = ed.document_type_id AND dt.deleted_at IS NULL
        WHERE ed.deleted_at IS NULL
      ),
      por_colaborador AS (
        SELECT employee_id, bool_and(entregue) AS conforme
        FROM vinculo
        GROUP BY employee_id
      )
      SELECT
        100.0 * count(*) FILTER (WHERE entregue) / NULLIF(count(*), 0)
          AS documents_submitted_percentage,
        (
          SELECT 100.0 * count(*) FILTER (WHERE conforme) / NULLIF(count(*), 0)
          FROM por_colaborador
        ) AS employees_fully_compliant_percentage
      FROM vinculo;
    `);

    const [linha] = linhas;

    return {
      documentsSubmittedPercentage: Number(linha.documents_submitted_percentage),
      employeesFullyCompliantPercentage: Number(linha.employees_fully_compliant_percentage),
    };
  }
}
