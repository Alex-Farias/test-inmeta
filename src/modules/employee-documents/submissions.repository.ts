import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';

import { DocumentSubmission } from './domain/document-submission.entity';

@Injectable()
export class SubmissionsRepository {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  /** `manager` opcional (D-05) — usado pelo transacional quando fornecido. */
  private repo(manager?: EntityManager): Repository<DocumentSubmission> {
    return (manager ?? this.dataSource.manager).getRepository(DocumentSubmission);
  }

  /**
   * **Unico ponto do sistema que ignora o filtro de soft delete de proposito.**
   *
   * Por 1.3 do design a proxima versao e `COALESCE(MAX(version), 0) + 1` sobre
   * **todas** as submissions do vinculo, inclusive as removidas. Filtrar
   * removidas aqui reemitiria um numero ja usado, e `uq_submission_version` —
   * que nao e parcial justamente por isso — rejeitaria a insercao. REQ-08.4
   * exige que o contador nao reinicie.
   *
   * O `.withDeleted()` nao e vazamento: e o requisito. Qualquer autorrevisao
   * que o encontre deve parar neste comentario antes de "corrigi-lo".
   */
  async findNextVersion(employeeDocumentId: string, manager?: EntityManager): Promise<number> {
    const resultado = await this.repo(manager)
      .createQueryBuilder('submission')
      .withDeleted()
      .select('COALESCE(MAX(submission.version), 0) + 1', 'proxima')
      .where('submission.employee_document_id = :employeeDocumentId', { employeeDocumentId })
      .getRawOne<{ proxima: string }>();

    // `MAX` sobre integer volta como string no driver do Postgres.
    return Number(resultado?.proxima ?? 1);
  }

  create(
    employeeDocumentId: string,
    version: number,
    manager?: EntityManager,
  ): Promise<DocumentSubmission> {
    const repo = this.repo(manager);
    return repo.save(
      repo.create({
        employeeDocumentId,
        version,
        isActive: true,
        submittedAt: new Date(),
      }),
    );
  }
}
