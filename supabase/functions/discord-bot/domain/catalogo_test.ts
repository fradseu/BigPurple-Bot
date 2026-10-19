import { assert, assertEquals } from "@std/assert";
import {
  areaDaPT,
  CandidatoBruto,
  extrairAtividadesDaPT,
  extrairDetalhesDaPT,
  idConfirmarConvite,
  idSelecaoCatalogo,
  idVoltarCatalogo,
  lerConfirmarConvite,
  lerSelecaoCatalogo,
  lerValorOpcao,
  lerVoltarCatalogo,
  montarCatalogo,
  montarTelaCatalogo,
  montarTelaConfirmacao,
  usuariosNaPT,
  vagaContinuaAberta,
  vagasAbertas,
  valorOpcao,
} from "./catalogo.ts";

const UUID = "123e4567-e89b-42d3-a456-426614174000";
const PT = "1561785526485262489";
const AGORA = 1_800_000_000_000;

const candidato = (extra: Partial<CandidatoBruto> = {}): CandidatoBruto => ({
  id: UUID,
  userId: "111111111111111111",
  codigo: "M24",
  classes: ["BADÔNICO"],
  tier: "T7",
  areas: ["PVE"],
  criadoEmMs: AGORA - 12 * 60_000,
  ...extra,
});

const LINHAS = [
  "📊 **Vagas:** (1/4)",
  "",
  "(1/1) <:defensivo:1> TANK <@999999999999999999> ",
  "(0/1) <:arcolongo:2> BADÔNICO ",
  "(0/1) <:arcolongo:3> FURA-BRUMA ",
  "(0/1) <:curandeiro:4> MAIN HEALER ",
];

Deno.test("extrairAtividadesDaPT: lê uma ou várias atividades", () => {
  assertEquals(extrairAtividadesDaPT("**T**\n📋 **Atividade:** DG Grupo + Caçada\n📍 x"), ["DG Grupo", "Caçada"]);
  assertEquals(extrairAtividadesDaPT("📋 **Atividade:** Roaming/Gank"), ["Roaming/Gank"]);
  assertEquals(extrairAtividadesDaPT("sem linha de atividade"), []);
});


const CONTENT_REAL = [
  "**TESTES**",
  "👑 Criador: <@439150217338814464>",
  "📋 **Atividade:** DG Fixa",
  "📍 **Ponto de Encontro:** Thetford Royal",
  "🗺️ **Ambiente:** Zona Amarela",
  "🗓️ **Quando:** 19/10/2026 às 14:19",
  "",
  "⚔️ **REQUISITOS MÍNIMOS:**",
  "• **Builds tier:** T5.0 Equivalente",
  "• **Set de Skip:** Dispensado",
  "",
  "💬 Escolha seu papel no dropdown abaixo. Caso desista da vaga, clique no botão ❌ Sair da PT.",
  "@everyone",
].join("\n");

Deno.test("extrairDetalhesDaPT: leva atividade, local, ambiente, quando e requisitos", () => {
  const d = extrairDetalhesDaPT(CONTENT_REAL);
  for (const esperado of ["DG Fixa", "Thetford Royal", "Zona Amarela", "19/10/2026", "REQUISITOS MÍNIMOS", "T5.0", "Dispensado"]) {
    assert(d.includes(esperado), `faltou "${esperado}"`);
  }
});

Deno.test("extrairDetalhesDaPT: NUNCA leva o criador, o título repetido, o texto do dropdown nem o @everyone", () => {
  const d = extrairDetalhesDaPT(CONTENT_REAL);
  assert(!d.includes("Criador") && !d.includes("439150217338814464"), "vazou o criador");
  assert(!d.includes("TESTES"), "repetiu o título");
  assert(!d.includes("Escolha seu papel") && !d.includes("@everyone"), "levou o rodapé do painel");
});

Deno.test("extrairDetalhesDaPT: painel sem a linha 💬 (formato antigo) não quebra", () => {
  const d = extrairDetalhesDaPT("**T**\n👑 Criador: <@1>\n📋 **Atividade:** Apagas");
  assertEquals(d, "📋 **Atividade:** Apagas");
});

Deno.test("vagasAbertas: só linhas livres, sem repetir função, com rótulo legível", () => {
  const abertas = vagasAbertas([...LINHAS, "(0/1) <:arcolongo:2> BADÔNICO "]);
  assertEquals(abertas.map((v) => v.rotulo), ["BADÔNICO", "FURA-BRUMA", "MAIN HEALER"]);
});

Deno.test("vagasAbertas: ignora ocupadas e a linha do criador", () => {
  const abertas = vagasAbertas(["👑 Criador: <@1>", "(1/1) TANK <@2> ", "(0/1) TANK "]);
  assertEquals(abertas.map((v) => v.rotulo), ["TANK"]);
});

Deno.test("vagaContinuaAberta: confirma que a vaga ainda está livre (ou não está)", () => {
  assert(vagaContinuaAberta(LINHAS, "BADÔNICO"));
  assert(vagaContinuaAberta(LINHAS, "fura-bruma")); // ignora caixa/hífen
  assert(!vagaContinuaAberta(LINHAS, "TANK")); // ocupada
  assert(!vagaContinuaAberta(LINHAS, "SCOUT")); // nunca existiu na PT
});

Deno.test("vagaContinuaAberta: depois que a última vaga da função é ocupada, deixa de estar aberta", () => {
  const ocupada = LINHAS.map((l) => l.includes("BADÔNICO") ? "(1/1) <:arcolongo:2> BADÔNICO <@5> " : l);
  assert(!vagaContinuaAberta(ocupada, "BADÔNICO"));
});

Deno.test("usuariosNaPT: pega as menções das vagas ocupadas", () => {
  assertEquals([...usuariosNaPT(LINHAS)], ["999999999999999999"]);
});

Deno.test("areaDaPT: acha pelo canal ou pelo pai (a PT mora num tópico do canal de ping)", () => {
  const mapa = { "100": "PVE", "200": "PVP" };
  assertEquals(areaDaPT([null, "200"], mapa), "PVP");
  assertEquals(areaDaPT(["999", "100"], mapa), "PVE");
  assertEquals(areaDaPT(["999", undefined], mapa), null);
});

Deno.test("montarCatalogo: cruza classe do candidato com vaga aberta (ignora formato/hífen)", () => {
  const abertas = vagasAbertas(LINHAS);
  const r = montarCatalogo({
    candidatos: [candidato({ classes: ["badônico", "FURA-BRUMA"] })],
    abertas, liderId: "1", naPT: new Set(), jaConvidados: new Set(), agoraMs: AGORA,
  });
  assertEquals(r.map((o) => o.classe), ["BADÔNICO", "FURA-BRUMA"]);
  assertEquals(r[0].minutosDisponivel, 12);
});

Deno.test("montarCatalogo: quem joga só classes SEM vaga aberta não aparece", () => {
  const r = montarCatalogo({
    candidatos: [candidato({ classes: ["TANK"] })], // TANK está ocupada
    abertas: vagasAbertas(LINHAS), liderId: "1", naPT: new Set(), jaConvidados: new Set(), agoraMs: AGORA,
  });
  assertEquals(r.length, 0);
});

Deno.test("montarCatalogo: exclui o próprio líder, quem já está na PT e quem já foi convidado", () => {
  const abertas = vagasAbertas(LINHAS);
  const base = { abertas, agoraMs: AGORA };
  const lider = montarCatalogo({ ...base, candidatos: [candidato({ userId: "LID" })], liderId: "LID", naPT: new Set(), jaConvidados: new Set() });
  const naPt = montarCatalogo({ ...base, candidatos: [candidato({ userId: "X" })], liderId: "1", naPT: new Set(["X"]), jaConvidados: new Set() });
  const convidado = montarCatalogo({ ...base, candidatos: [candidato()], liderId: "1", naPT: new Set(), jaConvidados: new Set([UUID]) });
  assertEquals([lider.length, naPt.length, convidado.length], [0, 0, 0]);
});

Deno.test("montarCatalogo: quem espera há mais tempo vem primeiro", () => {
  const r = montarCatalogo({
    candidatos: [
      candidato({ id: "b".repeat(8) + "-0000-4000-8000-000000000002", codigo: "NEW", criadoEmMs: AGORA - 1 * 60_000 }),
      candidato({ id: "a".repeat(8) + "-0000-4000-8000-000000000001", codigo: "OLD", criadoEmMs: AGORA - 30 * 60_000 }),
    ],
    abertas: vagasAbertas(LINHAS), liderId: "1", naPT: new Set(), jaConvidados: new Set(), agoraMs: AGORA,
  });
  assertEquals(r.map((o) => o.codigo), ["OLD", "NEW"]);
});

Deno.test("montarCatalogo: respeita o limite de 25 opções do Discord", () => {
  const muitos = Array.from({ length: 40 }, (_, i) =>
    candidato({ id: `${String(i).padStart(8, "0")}-0000-4000-8000-000000000000`, userId: String(i) }));
  const r = montarCatalogo({ candidatos: muitos, abertas: vagasAbertas(LINHAS), liderId: "x", naPT: new Set(), jaConvidados: new Set(), agoraMs: AGORA });
  assertEquals(r.length, 25);
});

Deno.test("anonimato: a opção do catálogo não carrega o id do usuário", () => {
  const r = montarCatalogo({
    candidatos: [candidato({ userId: "123456789012345678" })],
    abertas: vagasAbertas(LINHAS), liderId: "1", naPT: new Set(), jaConvidados: new Set(), agoraMs: AGORA,
  });
  const tela = montarTelaCatalogo(r, PT);
  assert(!JSON.stringify(r).includes("123456789012345678"));
  assert(!JSON.stringify(tela).includes("123456789012345678"));
  assert(!/<@!?\d+>/.test(JSON.stringify(tela)), "catálogo não pode ter menção de ninguém");
});

Deno.test("IDs dos componentes: ida e volta, e rejeita lixo", () => {
  assertEquals(lerSelecaoCatalogo(idSelecaoCatalogo(PT)), { ptMsgId: PT });
  assertEquals(lerVoltarCatalogo(idVoltarCatalogo(PT)), { ptMsgId: PT });
  assertEquals(lerConfirmarConvite(idConfirmarConvite(UUID, PT, "FURA-BRUMA")), { dispId: UUID, ptMsgId: PT, classe: "FURA-BRUMA" });
  assertEquals(lerSelecaoCatalogo("ptcat_sel:abc"), null);
  assertEquals(lerConfirmarConvite("ptconv_ok:nao-uuid:1:TANK"), null);
  assertEquals(lerConfirmarConvite(`ptconv_ok:${UUID}:${PT}:`), null);
});

Deno.test("custom_id de confirmação cabe nos 100 caracteres do Discord (maior classe)", () => {
  assert(idConfirmarConvite(UUID, PT, "ADAGA DE UMA MÃO").length <= 100);
});

Deno.test("valor da opção: ida e volta, e rejeita valor adulterado", () => {
  const o = montarCatalogo({ candidatos: [candidato()], abertas: vagasAbertas(LINHAS), liderId: "1", naPT: new Set(), jaConvidados: new Set(), agoraMs: AGORA })[0];
  assertEquals(lerValorOpcao(valorOpcao(o)), { dispId: UUID, classe: "BADÔNICO", codigo: "M24" });
  assertEquals(lerValorOpcao("lixo"), null);
  assertEquals(lerValorOpcao(`${UUID}|TANK|<script>`), null);
});

Deno.test("tela do catálogo: vazia mostra aviso sem lista; com opções traz uma lista", () => {
  const vazia = montarTelaCatalogo([], PT);
  assertEquals(vazia.components.length, 0);
  assert(vazia.embeds[0].description!.includes("Ninguém disponível"));
  const cheia = montarTelaCatalogo(
    [{ disponibilidadeId: UUID, codigo: "M24", classe: "BADÔNICO", tier: "T7", areas: ["PVE"], minutosDisponivel: 3 }],
    PT,
  );
  assertEquals(cheia.components.length, 1);
});

Deno.test("tela de confirmação: mostra código e vaga, com Convidar e Voltar", () => {
  const t = montarTelaConfirmacao("M24", "BADÔNICO", UUID, PT);
  assert(t.embeds[0].description!.includes("#M24") && t.embeds[0].description!.includes("BADÔNICO"));
  assertEquals(t.components[0].components.length, 2);
});
