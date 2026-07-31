/**
 * Ferramentas para testes de concorrencia.
 *
 * **O problema que isto resolve.** `Promise.all` sobre duas chamadas de service
 * nao garante que as transacoes se sobreponham. Sob execucao rapida em
 * `READ COMMITTED`, a primeira costuma commitar antes de a segunda comecar, e o
 * teste passa por motivo errado — validando o caminho sequencial enquanto
 * afirma testar concorrencia. Foi o que aconteceu com a primeira versao do
 * teste da TASK-039, que na verdade provava a ausencia de suporte a reenvio.
 *
 * A correcao e sincronizar explicitamente o ponto de sobreposicao: prender
 * todos os participantes dentro das suas transacoes, num ponto **depois** de
 * ela abrir e **antes** da escrita disputada, e so entao liberar todos.
 *
 * Ver `specs/design.md`, secao 5.
 */

/** Ponto de encontro: libera todos quando o ultimo participante chega. */
export interface Barreira {
  aguardar(): Promise<void>;
}

/**
 * `participantes` e o numero de chamadas concorrentes que precisam se
 * encontrar. Se menos que isso chegarem, a barreira nunca libera e o teste
 * estoura por timeout — falha barulhenta, que e o que se quer: significa que a
 * sobreposicao presumida nao estava acontecendo.
 */
export function criarBarreira(participantes: number): Barreira {
  let chegaram = 0;
  let liberar!: () => void;
  const portao = new Promise<void>((resolve) => {
    liberar = resolve;
  });

  return {
    aguardar() {
      chegaram += 1;
      if (chegaram >= participantes) {
        liberar();
      }
      return portao;
    },
  };
}

/**
 * Instala a barreira **dentro** de um metodo do alvo: toda chamada passa a
 * esperar no ponto de encontro antes de executar o comportamento original.
 *
 * Escolha o metodo de modo que a espera caia depois de a transacao abrir e
 * antes da escrita disputada — tipicamente a leitura que antecede a escrita.
 * Assim todas as transacoes ficam abertas simultaneamente, e a disputa e real.
 *
 * Devolve a funcao que restaura o metodo original; chame-a no `finally`.
 */
export function sincronizarEm<T extends object, K extends keyof T>(
  alvo: T,
  metodo: K,
  barreira: Barreira,
): () => void {
  const original = alvo[metodo];
  const substituto = async (...args: unknown[]): Promise<unknown> => {
    await barreira.aguardar();
    return (original as (...argumentos: unknown[]) => Promise<unknown>).apply(alvo, args);
  };

  alvo[metodo] = substituto as T[K];

  return () => {
    alvo[metodo] = original;
  };
}
