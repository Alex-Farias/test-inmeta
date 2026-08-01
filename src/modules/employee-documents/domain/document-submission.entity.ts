import { ApiProperty } from '@nestjs/swagger';
import {
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  PrimaryGeneratedColumn,
  UpdateDateColumn,
} from 'typeorm';

/**
 * O envio, distinto da obrigacao (D-01): cada reenvio gera uma linha nova, e e
 * dessa separacao que saem historico, versao ativa unica e pendencia derivada
 * sem mecanismo adicional.
 *
 * Colunas em snake_case explicito pelo mesmo motivo das demais entidades: nao
 * ha `NamingStrategy` em `data-source.ts` e a migration e escrita a mao (D-11).
 *
 * Sem `@ManyToOne` para `EmployeeDocument`: o vinculo e por coluna uuid
 * simples, como nas outras entidades do projeto.
 */
@Entity('document_submissions')
export class DocumentSubmission {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty({ format: 'uuid' })
  @Column({ name: 'employee_document_id', type: 'uuid' })
  employeeDocumentId!: string;

  /**
   * `@Column` comum, **nao** `@VersionColumn`: aquele e o contador de lock
   * otimista do TypeORM, incrementado por ele a cada `save`. Esta coluna e
   * dominio — sequencial por vinculo, calculada por
   * `COALESCE(MAX(version), 0) + 1` sobre todas as submissions do vinculo,
   * inclusive removidas (REQ-08.4).
   */
  @ApiProperty()
  @Column({ type: 'integer' })
  version!: number;

  /**
   * No maximo um `true` por vinculo, garantido por `uq_submission_active`
   * (D-02). A garantia vive no schema, nao em disciplina de codigo.
   */
  @ApiProperty()
  @Column({ name: 'is_active', type: 'boolean', default: true })
  isActive!: boolean;

  /** REQ-06.3 — o instante em que a entrega ocorreu. */
  @ApiProperty()
  @Column({ name: 'submitted_at', type: 'timestamptz' })
  submittedAt!: Date;

  @ApiProperty()
  @CreateDateColumn({ name: 'created_at', type: 'timestamptz' })
  createdAt!: Date;

  @ApiProperty()
  @UpdateDateColumn({ name: 'updated_at', type: 'timestamptz' })
  updatedAt!: Date;

  @ApiProperty({ nullable: true, type: String })
  @DeleteDateColumn({ name: 'deleted_at', type: 'timestamptz' })
  deletedAt!: Date | null;
}
