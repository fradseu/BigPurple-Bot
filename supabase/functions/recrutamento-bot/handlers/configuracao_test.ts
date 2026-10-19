import { assert, assertEquals } from "@std/assert";
import { ConfigRow } from "../db/client.ts";
import { formatarStatus } from "./configuracao.ts";

const config = (extra: Partial<ConfigRow> = {}): ConfigRow => ({
  guild_id: "1",
  canal_recrutadores_id: null,
  cargo_recrutador_id: null,
  cargo_membro_id: null,
  autorizados_usuarios: [],
  autorizados_cargos: [],
  atualizado_por: null,
  atualizado_em: "2026-10-19T00:00:00Z",
  ...extra,
});

Deno.test("formatarStatus: servidor sem configuração avisa que falta o canal", () => {
  const texto = formatarStatus(null);
  assert(texto.includes("❌ não definido"));
  assert(texto.includes("Falta definir o **canal**"));
  assertEquals(texto.match(/nenhum/g)?.length, 2); // usuários e cargos
});

Deno.test("formatarStatus: mostra canal, cargo e autorizados como menções", () => {
  const texto = formatarStatus(config({
    canal_recrutadores_id: "111",
    cargo_recrutador_id: "222",
    cargo_membro_id: "666",
    autorizados_usuarios: ["333", "444"],
    autorizados_cargos: ["555"],
  }));
  assert(texto.includes("<#111>"));
  assert(texto.includes("<@&222>"));
  assert(texto.includes("<@&666>")); // cargo de Membro
  assert(texto.includes("<@333>, <@444>"));
  assert(texto.includes("<@&555>"));
  assert(!texto.includes("Falta definir")); // canal definido = sem aviso
});
