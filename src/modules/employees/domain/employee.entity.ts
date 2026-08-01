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
 * Colunas nomeadas explicitamente em snake_case (`name: '...'`): nao ha
 * `NamingStrategy` configurada em `data-source.ts`, e a migration (escrita a
 * mao, D-11) usa snake_case. Sem o nome explicito, o TypeORM mapearia para o
 * nome da propriedade e a entidade divergiria do schema real.
 */
@Entity('employees')
export class Employee {
  @ApiProperty({ format: 'uuid' })
  @PrimaryGeneratedColumn('uuid')
  id!: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 150 })
  name!: string;

  @ApiProperty()
  @Column({ type: 'varchar', length: 255 })
  email!: string;

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
