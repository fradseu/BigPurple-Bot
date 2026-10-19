import { assert, assertEquals } from "@std/assert";
import { validarPedidoPreencher } from "./inscricaoInterna.ts";

const SNOW = "439150217338814464";
const base = { guild_id: SNOW, pt_canal_id: SNOW, pt_mensagem_id: SNOW, user_id: SNOW, classe: "BADÔNICO" };

Deno.test("pedido sem 'tipo' (Pool antigo) vale como preencher", () => {
  const r = validarPedidoPreencher(base);
  assertEquals(r?.tipo, "preencher");
  assertEquals(r?.classeRemover, null);
});

Deno.test("agregar: aceito sem classe_remover", () => {
  assertEquals(validarPedidoPreencher({ ...base, tipo: "agregar" })?.tipo, "agregar");
});

Deno.test("substituir: exige classe_remover", () => {
  assertEquals(validarPedidoPreencher({ ...base, tipo: "substituir" }), null);
  const r = validarPedidoPreencher({ ...base, tipo: "substituir", classe_remover: "MAIN HEALER" });
  assertEquals(r?.classeRemover, "MAIN HEALER");
});

Deno.test("classe_remover fora do 'substituir' é pedido inválido", () => {
  assertEquals(validarPedidoPreencher({ ...base, tipo: "agregar", classe_remover: "TANK" }), null);
  assertEquals(validarPedidoPreencher({ ...base, classe_remover: "TANK" }), null);
});

Deno.test("tipo desconhecido, IDs que não são snowflake e classe vazia ou gigante são recusados", () => {
  assertEquals(validarPedidoPreencher({ ...base, tipo: "trocar" }), null);
  assertEquals(validarPedidoPreencher({ ...base, user_id: "abc" }), null);
  assertEquals(validarPedidoPreencher({ ...base, user_id: "1; drop" }), null);
  assertEquals(validarPedidoPreencher({ ...base, classe: "   " }), null);
  assertEquals(validarPedidoPreencher({ ...base, classe: "X".repeat(61) }), null);
  assertEquals(validarPedidoPreencher(null), null);
  assertEquals(validarPedidoPreencher("texto"), null);
});

Deno.test("pedido válido devolve exatamente os campos usados (sem sobras do corpo recebido)", () => {
  const r = validarPedidoPreencher({ ...base, extra: "ignorado" });
  assert(r !== null && !("extra" in r));
});
