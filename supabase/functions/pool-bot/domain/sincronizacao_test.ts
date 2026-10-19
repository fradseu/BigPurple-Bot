import { assertEquals } from "@std/assert";
import { CAIXAS_POR_RODADA, MembroResumo, membrosSemCaixa } from "./sincronizacao.ts";

const MEMBRO = "1559173250288975922";
const m = (id: string, roles: string[] = [MEMBRO], bot = false): MembroResumo => ({ user: { id, bot }, roles });

Deno.test("quem é Membro e não tem caixa entra na lista", () => {
  assertEquals(membrosSemCaixa([m("1"), m("2")], MEMBRO, new Set(), 10), ["1", "2"]);
});

Deno.test("quem já tem caixa fica de fora", () => {
  assertEquals(membrosSemCaixa([m("1"), m("2")], MEMBRO, new Set(["1"]), 10), ["2"]);
});

Deno.test("quem NÃO tem o cargo de Membro (visitante) não ganha caixa", () => {
  assertEquals(membrosSemCaixa([m("1", []), m("2", ["outro"]), m("3")], MEMBRO, new Set(), 10), ["3"]);
});

Deno.test("bots nunca ganham caixa, mesmo com o cargo", () => {
  assertEquals(membrosSemCaixa([m("1", [MEMBRO], true), m("2")], MEMBRO, new Set(), 10), ["2"]);
});

Deno.test("respeita o limite por rodada e o resto fica pra próxima", () => {
  const muitos = Array.from({ length: 25 }, (_, i) => m(String(i + 1)));
  const primeira = membrosSemCaixa(muitos, MEMBRO, new Set(), CAIXAS_POR_RODADA);
  assertEquals(primeira.length, 10);
  const segunda = membrosSemCaixa(muitos, MEMBRO, new Set(primeira), CAIXAS_POR_RODADA);
  assertEquals(segunda.length, 10);
  assertEquals(segunda.some((id) => primeira.includes(id)), false); // não repete quem já foi
});

Deno.test("membro repetido na lista (paginação sobreposta) vira uma caixa só", () => {
  assertEquals(membrosSemCaixa([m("1"), m("1"), m("2")], MEMBRO, new Set(), 10), ["1", "2"]);
});

Deno.test("lista vazia, ou ninguém elegível, não quebra", () => {
  assertEquals(membrosSemCaixa([], MEMBRO, new Set(), 10), []);
  assertEquals(membrosSemCaixa([m("1", [])], MEMBRO, new Set(), 10), []);
  assertEquals(membrosSemCaixa([m("1")], MEMBRO, new Set(["1"]), 10), []);
});

Deno.test("limite zero não cria nada", () => {
  assertEquals(membrosSemCaixa([m("1")], MEMBRO, new Set(), 0), []);
});
