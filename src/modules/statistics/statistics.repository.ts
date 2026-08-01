import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

export interface ConformidadeGlobal {
  employeesFullyCompliantPercentage: number;
  documentsSubmittedPercentage: number;
  employeesWithoutRequirements: number;
}

interface LinhaDeConformidade {
  documents_submitted_percentage: string | null;
  employees_fully_compliant_percentage: string | null;
  employees_without_requirements: string;
}

export interface TipoPendente {
  documentType: { id: string; name: string };
  pendingCount: number;
}

interface LinhaDeTipoPendente {
  id: string;
  name: string;
  pending_count: string;
}

export interface UltimoEnvio {
  employee: { id: string; name: string };
  documentType: { id: string; name: string };
  version: number;
  submittedAt: Date;
}

interface LinhaDeUltimoEnvio {
  employee_id: string;
  employee_name: string;
  document_type_id: string;
  document_type_name: string;
  version: number;
  submitted_at: Date;
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
   * As três leituras de D-09 num único round-trip. `vinculo` é vínculo ativo
   * de colaborador ativo e tipo ativo (os três `JOIN ... AND deleted_at IS
   * NULL` são D-06 — join manual não recebe o filtro automático do
   * `@DeleteDateColumn`), com `entregue` via `EXISTS` contra submission ativa.
   * `documents_submitted_percentage` agrega direto sobre `vinculo`;
   * `employees_fully_compliant_percentage` agrupa por colaborador
   * (`bool_and(entregue)`) numa CTE separada e agrega por subquery escalar.
   *
   * `employees_without_requirements` (REQ-16.4) conta colaborador ativo sem
   * nenhuma linha em `por_colaborador` — ela já exclui por construção quem
   * não tem vínculo (deriva de `vinculo`, que vem de `employee_documents`);
   * esta subquery só torna essa exclusão visível como número, em vez de
   * silenciosa no denominador.
   *
   * `NULLIF` nas duas divisões: sem base a expressão retorna `NULL`, e
   * `Number(null)` é `0` — contrato de REQ-16.6 fixado em D-09 (TASK-055).
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
        ) AS employees_fully_compliant_percentage,
        (
          SELECT count(*) FROM employees e
          WHERE e.deleted_at IS NULL
            AND NOT EXISTS (SELECT 1 FROM por_colaborador pc WHERE pc.employee_id = e.id)
        ) AS employees_without_requirements
      FROM vinculo;
    `);

    const [linha] = linhas;

    return {
      documentsSubmittedPercentage: Number(linha.documents_submitted_percentage),
      employeesFullyCompliantPercentage: Number(linha.employees_fully_compliant_percentage),
      employeesWithoutRequirements: Number(linha.employees_without_requirements),
    };
  }

  /**
   * Reaproveita a definição de pendência de D-03/§1.4 (vínculo ativo de
   * colaborador ativo, sem submission ativa) numa CTE, e faz `LEFT JOIN` a
   * partir de `document_types` — não do anti-join. É o que garante REQ-17.1
   * **literal**: "para cada tipo de documento ativo", inclusive os com zero
   * pendências, que um `INNER JOIN`/anti-join direto omitiria em silêncio.
   *
   * `ORDER BY pending_count DESC, dt.id ASC`: o desempate por `id` é a mesma
   * convenção de desempate determinístico usada em toda listagem do projeto
   * (D-15) — aqui prova REQ-17.3 (duas consultas idênticas, mesma ordem).
   *
   * Tipo removido não aparece (`FROM document_types` já filtrado por
   * `deleted_at IS NULL`); vínculo ou colaborador removido não conta (os dois
   * `deleted_at IS NULL` da CTE `pendente`, D-06). A prova explícita dessas
   * exclusões é a TASK-060 — aqui é só a construção que já as garante.
   */
  async rankingDeTiposPendentes(manager?: EntityManager): Promise<TipoPendente[]> {
    const executor = manager ?? this.dataSource;

    const linhas = await executor.query<LinhaDeTipoPendente[]>(`
      WITH pendente AS (
        SELECT ed.id, ed.document_type_id
        FROM employee_documents ed
        JOIN employees e ON e.id = ed.employee_id AND e.deleted_at IS NULL
        WHERE ed.deleted_at IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM document_submissions s
            WHERE s.employee_document_id = ed.id
              AND s.is_active
              AND s.deleted_at IS NULL
          )
      )
      SELECT dt.id, dt.name, count(p.id) AS pending_count
      FROM document_types dt
      LEFT JOIN pendente p ON p.document_type_id = dt.id
      WHERE dt.deleted_at IS NULL
      GROUP BY dt.id, dt.name
      ORDER BY pending_count DESC, dt.id ASC;
    `);

    return linhas.map((linha) => ({
      documentType: { id: linha.id, name: linha.name },
      pendingCount: Number(linha.pending_count),
    }));
  }

  /**
   * Sem filtro de `is_active`: nada em REQ-18.1/18.2 pede envio ativo, e a
   * tradução direta do requisito já inclui versão superada por reenvio — é o
   * que a TASK-058 prova de ponta a ponta, não o que introduz.
   *
   * `ORDER BY submitted_at DESC, id DESC` usa `idx_submissions_recent`
   * (§1.3) e já cobre o desempate determinístico de instante empatado
   * (REQ-18.6).
   *
   * Os três `JOIN ... AND deleted_at IS NULL` são D-06 (REQ-18.4): vínculo,
   * colaborador ou tipo removido tiram o envio do resultado. Submission
   * removida (via `softDeleteActive`, TASK-046) também some — REQ-18 não
   * declara exceção ao soft delete, ao contrário de REQ-09 para o histórico
   * do vínculo, então segue a regra padrão de D-06/REQ-14.2.
   */
  async ultimosEnvios(limit: number, manager?: EntityManager): Promise<UltimoEnvio[]> {
    const executor = manager ?? this.dataSource;

    const linhas = await executor.query<LinhaDeUltimoEnvio[]>(
      `
      SELECT
        ed.employee_id,
        e.name AS employee_name,
        ed.document_type_id,
        dt.name AS document_type_name,
        s.version,
        s.submitted_at
      FROM document_submissions s
      JOIN employee_documents ed ON ed.id = s.employee_document_id AND ed.deleted_at IS NULL
      JOIN employees      e  ON e.id  = ed.employee_id      AND e.deleted_at  IS NULL
      JOIN document_types dt ON dt.id = ed.document_type_id AND dt.deleted_at IS NULL
      WHERE s.deleted_at IS NULL
      ORDER BY s.submitted_at DESC, s.id DESC
      LIMIT $1;
    `,
      [limit],
    );

    return linhas.map((linha) => ({
      employee: { id: linha.employee_id, name: linha.employee_name },
      documentType: { id: linha.document_type_id, name: linha.document_type_name },
      version: linha.version,
      submittedAt: linha.submitted_at,
    }));
  }
}
