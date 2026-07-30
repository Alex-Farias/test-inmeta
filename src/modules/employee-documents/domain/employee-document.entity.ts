import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

export type DeletionCause = 'MANUAL' | 'TYPE_REMOVED';

/**
 * Colunas nomeadas explicitamente em snake_case (`name: '...'`): nao ha
 * `NamingStrategy` configurada em `data-source.ts`, e a migration (escrita a
 * mao, D-11) usa snake_case. Sem o nome explicito, o TypeORM mapearia para o
 * nome da propriedade e a entidade divergiria do schema real.
 *
 * Sem `@ManyToOne` para `Employee`/`DocumentType`: o vinculo entre modulos e
 * por coluna uuid simples, nao por relacao TypeORM (2.1 do design — modulos
 * nao conhecem repositorio alheio).
 */
@Entity('employee_documents')
export class EmployeeDocument {
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @Column({ name: 'employee_id', type: 'uuid' })
  employeeId!: string;

  @Column({ name: 'document_type_id', type: 'uuid' })
  documentTypeId!: string;

  @Column({ name: 'deletion_cause', type: 'varchar', length: 20, nullable: true })
  deletionCause!: DeletionCause | null;

  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt!: Date | null;
}
