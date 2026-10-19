// codigoAnonimo.ts - O "nome" que o líder vê pra um candidato no catálogo (ex: #K7M).
//
// O código é derivado de (PT + disponibilidade), então:
//   - é estável dentro da mesma PT (o líder acha a mesma pessoa nas telas de confirmação);
//   - muda de PT pra PT, então um líder não reconhece a mesma pessoa em PTs diferentes;
//   - NÃO é o código interno da caixa nem aparece pro candidato: ele não tem como dizer
//     "eu sou o #K7M" pra se identificar, e ninguém liga o código do líder a uma pessoa.
// Sem I, L, O, 0 e 1: letras e números que se confundem quando lidos rápido.
const ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";
const TAMANHO_MINIMO = 3;
const TAMANHO_MAXIMO = 8;

async function codigoCompleto(dispId: string, ptMsgId: string): Promise<string> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest("SHA-256", new TextEncoder().encode(`${ptMsgId}:${dispId}`)),
  );
  return Array.from(bytes.slice(0, TAMANHO_MAXIMO), (b) => ALFABETO[b % ALFABETO.length]).join("");
}

// Um código por disponibilidade, todos distintos entre si dentro da PT. Começa com 3
// caracteres e só cresce (no conjunto todo) se dois candidatos caírem no mesmo código.
export async function codigosParaPT(dispIds: string[], ptMsgId: string): Promise<Map<string, string>> {
  const ids = [...new Set(dispIds)];
  const completos = await Promise.all(ids.map((id) => codigoCompleto(id, ptMsgId)));

  let tamanho = TAMANHO_MINIMO;
  while (tamanho < TAMANHO_MAXIMO && new Set(completos.map((c) => c.slice(0, tamanho))).size < ids.length) {
    tamanho++;
  }
  return new Map(ids.map((id, i) => [id, completos[i].slice(0, tamanho)]));
}
