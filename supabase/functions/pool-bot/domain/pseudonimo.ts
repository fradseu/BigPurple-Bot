// pseudonimo.ts - O "nome" anônimo que o líder vê no catálogo (ex: Candidato #K7M).
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

export function formatarPseudonimo(codigo: string): string {
  return `Candidato #${codigo}`;
}
