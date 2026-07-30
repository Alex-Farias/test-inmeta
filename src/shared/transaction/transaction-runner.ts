import { Injectable } from '@nestjs/common';
import { InjectDataSource } from '@nestjs/typeorm';
import { DataSource, EntityManager } from 'typeorm';

/**
 * Unico ponto que abre transacao no sistema (D-05). `READ COMMITTED` basta
 * porque a garantia de unicidade vive no indice parcial (D-02), nao em
 * isolamento de leitura repetivel.
 *
 * O `EntityManager` propagado ao callback e o que os repositorios recebem
 * como parametro opcional — o limite transacional fica explicito na
 * assinatura de quem chama, em vez de escondido atras de AsyncLocalStorage.
 */
@Injectable()
export class TransactionRunner {
  constructor(@InjectDataSource() private readonly dataSource: DataSource) {}

  run<T>(work: (manager: EntityManager) => Promise<T>): Promise<T> {
    return this.dataSource.transaction('READ COMMITTED', work);
  }
}
