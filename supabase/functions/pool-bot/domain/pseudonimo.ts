// pseudonimo.ts - Identificador interno da caixa (coluna `pseudonimo`, única por servidor).
// NÃO é mostrado a ninguém: nem ao dono da caixa, nem ao líder. O código que o líder vê no
// catálogo é outro e muda a cada PT (veja discord-bot/domain/codigoAnonimo.ts).
// Sem I, L, O, 0 e 1: letras e números que se confundem quando lidos rápido.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

// `rng` injetável (devolve 0 <= n < 1) pra o teste ser determinístico.
export function gerarCodigo(rng: () => number = Math.random, tamanho = 3): string {
  let codigo = "";
  for (let i = 0; i < tamanho; i++) {
    codigo += ALFABETO[Math.floor(rng() * ALFABETO.length)];
  }
  return codigo;
}
