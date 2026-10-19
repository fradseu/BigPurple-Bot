import { assert, assertEquals } from "@std/assert";
import {
  calcularExpiracaoConvite,
  CONVITE_TTL_MIN,
  idBotaoConvite,
  lerBotaoConvite,
  MAX_CONVITES_POR_PEDIDO,
  montarConvite,
  validarPedidoConvite,
} from "./convite.ts";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const SNOW = "439150217338814464";

const pedidoValido = () => ({
  guild_id: SNOW,
  pt_canal_id: SNOW,
  pt_mensagem_id: SNOW,
  pt_titulo: "DG Grupo | PVE",
  lider_user_id: SNOW,
  itens: [{ disponibilidade_id: UUID, classe: "BADÔNICO" }],
});

Deno.test("convite expira em 3 minutos", () => {
  assertEquals(CONVITE_TTL_MIN, 3);
  assertEquals(calcularExpiracaoConvite(1_000).getTime(), 1_000 + 3 * 60_000);
});

Deno.test("botões do convite: ida e volta, e rejeita lixo", () => {
  const id = idBotaoConvite("aceitar", UUID);
  assertEquals(id, `pool_aceitar:${UUID}`);
  assertEquals(lerBotaoConvite(id), { acao: "aceitar", conviteId: UUID });
  assertEquals(lerBotaoConvite(`pool_recusar:${UUID}`), { acao: "recusar", conviteId: UUID });
  assertEquals(lerBotaoConvite("pool_aceitar:nao-e-uuid"), null);
  assertEquals(lerBotaoConvite("pool_outra:" + UUID), null);
  assertEquals(lerBotaoConvite("pool_ficar"), null);
});

Deno.test("mensagem do convite: menciona a pessoa, mostra vaga e líder, botões certos", () => {
  const m = montarConvite({
    conviteId: UUID, candidatoUserId: "111111111111111111", liderUserId: "222222222222222222",
    ptTitulo: "DG Grupo | PVE", classe: "BADÔNICO", expiraEmMs: 1_800_000_000_000,
  });
  assert(m.content.includes("<@111111111111111111>"));
  assertEquals(m.allowed_mentions.users, ["111111111111111111"]);
  const d = m.embeds[0].description!;
  assert(d.includes("DG Grupo | PVE") && d.includes("BADÔNICO") && d.includes("<@222222222222222222>"));
  assertEquals(m.components[0].components.map((c) => "custom_id" in c ? c.custom_id : ""), [
    `pool_aceitar:${UUID}`,
    `pool_recusar:${UUID}`,
  ]);
});

Deno.test("mensagem do convite: não promete anonimato que não existe e não vaza id do candidato no embed", () => {
  const m = montarConvite({
    conviteId: UUID, candidatoUserId: "111111111111111111", liderUserId: "222222222222222222",
    ptTitulo: "PT", classe: "TANK", expiraEmMs: 1_800_000_000_000,
  });
  // o candidato só é mencionado no content (caixa privada), nunca dentro do embed
  assert(!JSON.stringify(m.embeds).includes("111111111111111111"));
});

Deno.test("validarPedidoConvite: aceita o pedido correto", () => {
  const r = validarPedidoConvite(pedidoValido());
  assertEquals(r?.itens.length, 1);
  assertEquals(r?.pt_titulo, "DG Grupo | PVE");
});

Deno.test("validarPedidoConvite: recusa formatos inválidos", () => {
  assertEquals(validarPedidoConvite(null), null);
  assertEquals(validarPedidoConvite("texto"), null);
  assertEquals(validarPedidoConvite({ ...pedidoValido(), guild_id: "abc" }), null);
  assertEquals(validarPedidoConvite({ ...pedidoValido(), lider_user_id: "1; drop table" }), null);
  assertEquals(validarPedidoConvite({ ...pedidoValido(), pt_titulo: "   " }), null);
  assertEquals(validarPedidoConvite({ ...pedidoValido(), itens: [] }), null);
  assertEquals(validarPedidoConvite({ ...pedidoValido(), itens: [{ disponibilidade_id: "x", classe: "TANK" }] }), null);
  assertEquals(validarPedidoConvite({ ...pedidoValido(), itens: [{ disponibilidade_id: UUID, classe: "" }] }), null);
});

Deno.test("validarPedidoConvite: limita a quantidade de itens por pedido", () => {
  const itens = Array.from({ length: MAX_CONVITES_POR_PEDIDO + 1 }, () => ({ disponibilidade_id: UUID, classe: "TANK" }));
  assertEquals(validarPedidoConvite({ ...pedidoValido(), itens }), null);
});
