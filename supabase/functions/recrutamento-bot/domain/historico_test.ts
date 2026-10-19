import { assertEquals } from "@std/assert";
import { montarHistoricoGuildas, SEM_GUILDA } from "./historico.ts";

const dia = (n: number) => Date.UTC(2026, 8, n); // setembro/2026

Deno.test("montarHistoricoGuildas: junta eventos seguidos na mesma guilda", () => {
  const r = montarHistoricoGuildas([
    { quando: dia(18), guilda: "BRIGA D BAR" },
    { quando: dia(20), guilda: "BRIGA D BAR" },
    { quando: dia(20) + 1000, guilda: "BRIGA D BAR" },
  ]);
  assertEquals(r.length, 1);
  assertEquals(r[0], { guilda: "BRIGA D BAR", primeiraVez: dia(18), ultimaVez: dia(20) + 1000, eventos: 3 });
});

Deno.test("montarHistoricoGuildas: ordena por tempo e devolve o mais recente primeiro", () => {
  const r = montarHistoricoGuildas([
    // fora de ordem de propósito (kills e mortes vêm de listas separadas)
    { quando: dia(25), guilda: "Big Purple" },
    { quando: dia(10), guilda: "Guilda A" },
    { quando: dia(18), guilda: "Guilda B" },
  ]);
  assertEquals(r.map((p) => p.guilda), ["Big Purple", "Guilda B", "Guilda A"]);
});

Deno.test("montarHistoricoGuildas: voltar pra uma guilda antiga cria nova passagem", () => {
  const r = montarHistoricoGuildas([
    { quando: dia(1), guilda: "A" },
    { quando: dia(2), guilda: "B" },
    { quando: dia(3), guilda: "A" },
  ]);
  assertEquals(r.map((p) => p.guilda), ["A", "B", "A"]);
});

Deno.test("montarHistoricoGuildas: guilda vazia/nula vira (sem guilda)", () => {
  const r = montarHistoricoGuildas([
    { quando: dia(1), guilda: null },
    { quando: dia(2), guilda: "" },
    { quando: dia(3), guilda: undefined },
  ]);
  assertEquals(r.length, 1);
  assertEquals(r[0].guilda, SEM_GUILDA);
  assertEquals(r[0].eventos, 3);
});

Deno.test("montarHistoricoGuildas: sem eventos = lista vazia", () => {
  assertEquals(montarHistoricoGuildas([]), []);
});
