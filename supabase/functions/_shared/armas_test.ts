import { assert, assertEquals } from "@std/assert";
import { ARVORES, arvoreDaClasse, classeAtendeVaga, CLASSES_ARMAS, CLASSES_FUNCOES } from "./armas.ts";

Deno.test("armas: catálogo completo, sem arma repetida", () => {
  assertEquals(ARVORES.length, 17);
  const nomes = ARVORES.flatMap((a) => a.armas.map((x) => x.nome.toUpperCase()));
  assertEquals(new Set(nomes).size, nomes.length);
  for (const a of ARVORES) assert(a.armas.length > 0 && a.armas.length <= 24, `${a.nome}: cabe no select (24 + genérica)`);
  assertEquals(CLASSES_FUNCOES.length, 5);
  assertEquals(CLASSES_ARMAS.length, nomes.length + ARVORES.length);
});

Deno.test("armas: árvore da classe ignora emoji, caixa e contador da vaga", () => {
  const natureza = ARVORES.find((a) => a.chave === "natureza")!;
  const arma = natureza.armas[0].nome;
  assertEquals(arvoreDaClasse(`:natureza: ${arma.toUpperCase()}`)?.chave, "natureza");
  assertEquals(arvoreDaClasse(`(0/1) 🌿 ${arma.toLowerCase()}`)?.chave, "natureza");
  assertEquals(arvoreDaClasse("TANK"), null);
});

Deno.test("armas: quem marcou a árvore no Pool atende qualquer arma dela", () => {
  const martelo = ARVORES.find((a) => a.chave === "martelo")!;
  const arma = martelo.armas[1].nome.toUpperCase();
  assert(classeAtendeVaga("MARTELO (QUALQUER)", `:martelo: ${arma}`));
  assert(classeAtendeVaga("MARTELO (QUALQUER)", ":martelo: MARTELO (QUALQUER)"));
  assert(!classeAtendeVaga("ARCO (QUALQUER)", `:martelo: ${arma}`));
  assert(classeAtendeVaga("TANK", ":defensivo: TANK"));
  assert(!classeAtendeVaga("TANK", ":defensivo: OFF TANK"));
  assert(!classeAtendeVaga(arma, ":martelo: MARTELO (QUALQUER)")); // arma específica não vira genérica
});
