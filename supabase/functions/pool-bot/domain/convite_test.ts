import { assert, assertEquals } from "@std/assert";
import {
  avaliarEnvio,
  calcularExpiracaoConvite,
  CONVITE_TTL_MIN,
  idBotaoConvite,
  lerBotaoConvite,
  MAX_CONVITES_POR_PEDIDO,
  montarConvite,
  sanitizarDetalhes,
  validarPedidoConvite,
} from "./convite.ts";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const SNOW = "439150217338814464";

const pedidoValido = () => ({
  guild_id: SNOW,
  pt_canal_id: SNOW,
  pt_mensagem_id: SNOW,
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

const DETALHES_DA_PT = [
  "👑 Criador: <@222222222222222222>",
  "📋 **Atividade:** DG Fixa",
  "📍 **Ponto de Encontro:** Thetford Royal",
  "🗺️ **Ambiente:** Zona Amarela",
  "🗓️ **Quando:** 19/10/2026 às 14:19",
  "",
  "⚔️ **REQUISITOS MÍNIMOS:**",
  "• **Builds tier:** T5.0 Equivalente",
  "• **Set de Skip:** Dispensado",
].join("\n");

Deno.test("mensagem do convite: menciona a pessoa, mostra PT, detalhes e vaga, botões certos", () => {
  const m = montarConvite({
    conviteId: UUID, candidatoUserId: "111111111111111111",
    ptDetalhes: DETALHES_DA_PT, classe: "BADÔNICO", expiraEmMs: 1_800_000_000_000,
  });
  assert(m.content.includes("<@111111111111111111>"));
  assertEquals(m.allowed_mentions.users, ["111111111111111111"]);
  const d = m.embeds[0].description!;
  for (const esperado of ["DG Fixa", "Thetford Royal", "Zona Amarela", "19/10/2026", "REQUISITOS", "T5.0", "Dispensado", "BADÔNICO"]) {
    assert(d.includes(esperado), `faltou "${esperado}" no convite`);
  }
  assertEquals(m.components[0].components.map((c) => "custom_id" in c ? c.custom_id : ""), [
    `pool_aceitar:${UUID}`,
    `pool_recusar:${UUID}`,
  ]);
});

Deno.test("ANONIMATO: o convite nunca mostra quem é o líder (nem o criador, nem menção)", () => {
  const m = montarConvite({
    conviteId: UUID, candidatoUserId: "111111111111111111",
    ptDetalhes: DETALHES_DA_PT, classe: "BADÔNICO", expiraEmMs: 1_800_000_000_000,
  });
  const tudo = JSON.stringify(m);
  assert(!tudo.includes("222222222222222222"), "o ID do líder vazou");
  assert(!/Líder|Criador|👑/.test(tudo), "mencionou líder/criador");
  // o único usuário mencionado no convite é o próprio candidato
  const mencoes = [...tudo.matchAll(/<@!?(\d+)>/g)].map((x) => x[1]);
  assertEquals([...new Set(mencoes)], ["111111111111111111"]);
});

Deno.test("o TÍTULO da PT não vai no convite (pode identificar o líder/grupo)", () => {
  const m = montarConvite({
    conviteId: UUID, candidatoUserId: "111111111111111111",
    ptDetalhes: DETALHES_DA_PT, classe: "BADÔNICO", expiraEmMs: 1_800_000_000_000,
  });
  assert(m.embeds[0].description!.trimStart().startsWith("📋 **Atividade:**"), "o convite deve começar pelos dados da oferta");
});

Deno.test("pedido com um pt_titulo a mais (bot de conteúdo antigo) não quebra nem vaza o título", () => {
  const r = validarPedidoConvite({ ...pedidoValido(), pt_titulo: "Grupo do Fulano" });
  assert(r !== null);
  assert(!JSON.stringify(r).includes("Grupo do Fulano"));
});

Deno.test("mensagem do convite: o candidato só é mencionado no content, nunca dentro do embed", () => {
  const m = montarConvite({
    conviteId: UUID, candidatoUserId: "111111111111111111",
    classe: "TANK", expiraEmMs: 1_800_000_000_000,
  });
  assert(!JSON.stringify(m.embeds).includes("111111111111111111"));
});

Deno.test("sanitizarDetalhes: tira o criador, menções e @everyone, mas mantém o resto", () => {
  const limpo = sanitizarDetalhes(DETALHES_DA_PT + "\n@everyone <@&333333333333333333>");
  assert(!limpo.includes("Criador") && !limpo.includes("<@"));
  assert(!limpo.includes("@everyone")); // não pode marcar ninguém
  assert(limpo.includes("Thetford Royal") && limpo.includes("Dispensado"));
});

Deno.test("sanitizarDetalhes: limita o tamanho", () => {
  assert(sanitizarDetalhes("x".repeat(5000)).length <= 1500);
});

Deno.test("validarPedidoConvite: aceita o pedido correto", () => {
  const r = validarPedidoConvite(pedidoValido());
  assertEquals(r?.itens.length, 1);
  assertEquals(r?.pt_detalhes, ""); // detalhes são opcionais
});

Deno.test("validarPedidoConvite: sanitiza os detalhes que chegam (nunca confia que vieram limpos)", () => {
  const r = validarPedidoConvite({ ...pedidoValido(), pt_detalhes: DETALHES_DA_PT });
  assert(r && !r.pt_detalhes.includes("222222222222222222") && !r.pt_detalhes.includes("Criador"));
  assert(r!.pt_detalhes.includes("Thetford Royal"));
});

Deno.test("validarPedidoConvite: detalhes com tipo errado são ignorados, não derrubam o pedido", () => {
  const r = validarPedidoConvite({ ...pedidoValido(), pt_detalhes: { x: 1 } });
  assertEquals(r?.pt_detalhes, "");
});

Deno.test("validarPedidoConvite: recusa formatos inválidos", () => {
  assertEquals(validarPedidoConvite(null), null);
  assertEquals(validarPedidoConvite("texto"), null);
  assertEquals(validarPedidoConvite({ ...pedidoValido(), guild_id: "abc" }), null);
  assertEquals(validarPedidoConvite({ ...pedidoValido(), lider_user_id: "1; drop table" }), null);
  assertEquals(validarPedidoConvite({ ...pedidoValido(), itens: [] }), null);
  assertEquals(validarPedidoConvite({ ...pedidoValido(), itens: [{ disponibilidade_id: "x", classe: "TANK" }] }), null);
  assertEquals(validarPedidoConvite({ ...pedidoValido(), itens: [{ disponibilidade_id: UUID, classe: "" }] }), null);
});

Deno.test("validarPedidoConvite: limita a quantidade de itens por pedido", () => {
  const itens = Array.from({ length: MAX_CONVITES_POR_PEDIDO + 1 }, () => ({ disponibilidade_id: UUID, classe: "TANK" }));
  assertEquals(validarPedidoConvite({ ...pedidoValido(), itens }), null);
});

// ---------------------------------------------------------------- tipos de convite

Deno.test("pedido sem 'tipo' (bot de conteúdo antigo) vale como 'preencher'", () => {
  const r = validarPedidoConvite(pedidoValido());
  assertEquals(r?.itens[0].tipo, "preencher");
  assertEquals(r?.itens[0].classe_remover, null);
});

Deno.test("agregar: aceita sem classe_remover", () => {
  const r = validarPedidoConvite({
    ...pedidoValido(),
    itens: [{ disponibilidade_id: UUID, classe: "FURA-BRUMA", tipo: "agregar" }],
  });
  assertEquals(r?.itens[0].tipo, "agregar");
  assertEquals(r?.itens[0].classe_remover, null);
});

Deno.test("substituir: EXIGE classe_remover", () => {
  const sem = validarPedidoConvite({
    ...pedidoValido(),
    itens: [{ disponibilidade_id: UUID, classe: "FURA-BRUMA", tipo: "substituir" }],
  });
  assertEquals(sem, null);
  const com = validarPedidoConvite({
    ...pedidoValido(),
    itens: [{ disponibilidade_id: UUID, classe: "FURA-BRUMA", tipo: "substituir", classe_remover: "BADÔNICO" }],
  });
  assertEquals(com?.itens[0].classe_remover, "BADÔNICO");
});

Deno.test("classe_remover só faz sentido no 'substituir' (nos outros é pedido inválido)", () => {
  for (const tipo of ["preencher", "agregar"]) {
    const r = validarPedidoConvite({
      ...pedidoValido(),
      itens: [{ disponibilidade_id: UUID, classe: "TANK", tipo, classe_remover: "DPS" }],
    });
    assertEquals(r, null, `tipo ${tipo} não pode ter classe_remover`);
  }
});

Deno.test("tipo desconhecido é recusado", () => {
  assertEquals(
    validarPedidoConvite({ ...pedidoValido(), itens: [{ disponibilidade_id: UUID, classe: "TANK", tipo: "trocar" }] }),
    null,
  );
});

Deno.test("convite de vaga NOVA avisa que a vaga foi criada, sem revelar que outra foi apagada", () => {
  const base = {
    conviteId: UUID, candidatoUserId: "111111111111111111", ptDetalhes: DETALHES_DA_PT,
    classe: "FURA-BRUMA", expiraEmMs: 1_800_000_000_000,
  };
  const velho = montarConvite({ ...base, tipo: "preencher" }).embeds[0].description!;
  const agregar = montarConvite({ ...base, tipo: "agregar" }).embeds[0].description!;
  const substituir = montarConvite({ ...base, tipo: "substituir" }).embeds[0].description!;
  assert(velho.includes("Vaga para você: FURA-BRUMA"));
  assert(agregar.includes("Vaga nova criada pra você: FURA-BRUMA"));
  assertEquals(agregar, substituir); // o convidado não vê a diferença
  assert(!/apag|remov|substitu/i.test(substituir));
});

// ---------------------------------------------------------------- anti-flood

const T0 = 1_800_000_000_000;
const MIN = 60_000;

Deno.test("anti-flood: a primeira vez sempre pode enviar", () => {
  assertEquals(avaliarEnvio(null, T0), { permitido: true });
});

Deno.test("anti-flood: antes de 5 minutos tem que esperar, e diz quanto falta", () => {
  const r = avaliarEnvio({ tentativas: 1, ultimoEnvioMs: T0 }, T0 + 2 * MIN);
  assertEquals(r, { permitido: false, motivo: "espere", esperaSeg: 180, tentativas: 1 });
});

Deno.test("anti-flood: com exatamente 5 minutos já pode", () => {
  assertEquals(avaliarEnvio({ tentativas: 1, ultimoEnvioMs: T0 }, T0 + 5 * MIN), { permitido: true });
});

Deno.test("anti-flood: arredonda a espera pra cima (nunca diz 0 segundos faltando)", () => {
  const r = avaliarEnvio({ tentativas: 2, ultimoEnvioMs: T0 }, T0 + 5 * MIN - 400);
  assert(!r.permitido && r.motivo === "espere" && r.esperaSeg === 1);
});

Deno.test("anti-flood: na 6ª tentativa bloqueia de vez ('na unha')", () => {
  assertEquals(
    avaliarEnvio({ tentativas: 5, ultimoEnvioMs: T0 }, T0 + 60 * MIN),
    { permitido: false, motivo: "limite", tentativas: 5 },
  );
});

Deno.test("anti-flood: a 5ª tentativa ainda passa; o limite pesa mais que o intervalo", () => {
  assertEquals(avaliarEnvio({ tentativas: 4, ultimoEnvioMs: T0 }, T0 + 6 * MIN), { permitido: true });
  const r = avaliarEnvio({ tentativas: 5, ultimoEnvioMs: T0 }, T0 + 1 * MIN);
  assert(!r.permitido && r.motivo === "limite"); // não é "espere": esperar não resolve
});
