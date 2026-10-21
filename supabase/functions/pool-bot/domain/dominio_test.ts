import { assert, assertEquals } from "@std/assert";
import { ATIVIDADES_POR_AREA, atividadesDasAreas, MAX_ATIVIDADES, MAX_CLASSES } from "../config.ts";
import { montarControle } from "./controle.ts";
import { gerarCodigo } from "./pseudonimo.ts";
import {
  aplicarSelecao,
  calcularExpiracao,
  estadoInicial,
  itensFaltando,
  lerEstado,
  wizardCompleto,
} from "./wizard.ts";

Deno.test("gerarCodigo: 3 caracteres, só do alfabeto sem ambíguos", () => {
  for (let i = 0; i < 200; i++) {
    const c = gerarCodigo();
    assertEquals(c.length, 3);
    assert(/^[A-HJKMNP-Z2-9]{3}$/.test(c), `código inválido: ${c}`);
    assert(!/[ILO01]/.test(c), `código com caractere ambíguo: ${c}`);
  }
});

Deno.test("gerarCodigo: determinístico com rng injetado", () => {
  assertEquals(gerarCodigo(() => 0), "AAA");
});

Deno.test("wizard: estado inicial já tem duração padrão, falta o resto", () => {
  const e = estadoInicial();
  assertEquals(e.duracaoMin, 120);
  assertEquals(itensFaltando(e), ["área", "atividade", "classe", "tier"]);
  assertEquals(wizardCompleto(e), false);
});

Deno.test("wizard: completa depois de escolher área, atividade, classe e tier", () => {
  let e = estadoInicial();
  e = aplicarSelecao(e, "areas", ["PVE"]);
  e = aplicarSelecao(e, "atividades", ["DG Grupo"]);
  e = aplicarSelecao(e, "classes", ["BADÔNICO"]);
  e = aplicarSelecao(e, "tier", ["T7"]);
  assertEquals(wizardCompleto(e), true);
});

Deno.test("wizard: valores fora da lista são ignorados (payload não é confiável)", () => {
  let e = aplicarSelecao(estadoInicial(), "areas", ["PVE", "INVENTADA"]);
  assertEquals(e.areas, ["PVE"]);
  e = aplicarSelecao(e, "atividades", ["DG Grupo", "hack", "<@123>"]);
  e = aplicarSelecao(e, "classes", ["BADÔNICO", "CLASSE_FALSA"]);
  assertEquals(e.atividades, ["DG Grupo"]);
  assertEquals(e.classes, ["BADÔNICO"]);
});

Deno.test("wizard: atividade de outra área é recusada (Guerra de Facção não é PVE)", () => {
  let e = aplicarSelecao(estadoInicial(), "areas", ["PVE"]);
  e = aplicarSelecao(e, "atividades", ["DG Grupo", "Guerra de Facção"]);
  assertEquals(e.atividades, ["DG Grupo"]);
});

Deno.test("wizard: sem área escolhida ainda, qualquer atividade válida é aceita", () => {
  const e = aplicarSelecao(estadoInicial(), "atividades", ["Guerra de Facção"]);
  assertEquals(e.atividades, ["Guerra de Facção"]);
});

Deno.test("wizard: trocar de área poda as atividades que deixaram de fazer sentido", () => {
  let e = aplicarSelecao(estadoInicial(), "areas", ["PVE", "FAC"]);
  e = aplicarSelecao(e, "atividades", ["DG Grupo", "Guerra de Facção"]);
  assertEquals(e.atividades.length, 2);
  e = aplicarSelecao(e, "areas", ["PVE"]); // tirou Facção
  assertEquals(e.atividades, ["DG Grupo"]);
});

Deno.test("wizard: atividade que pertence a mais de uma área sobrevive se UMA das áreas fica", () => {
  let e = aplicarSelecao(estadoInicial(), "areas", ["PVE", "PVP"]);
  e = aplicarSelecao(e, "atividades", ["Coleta na Black"]); // PVE e PVP
  e = aplicarSelecao(e, "areas", ["PVP"]);
  assertEquals(e.atividades, ["Coleta na Black"]);
});

Deno.test("atividadesDasAreas: união sem repetir, na ordem do criador de conteúdo", () => {
  const nomes = atividadesDasAreas(["PVE", "PVP"]).map((a) => a.value);
  assertEquals(new Set(nomes).size, nomes.length); // sem repetidos
  assert(nomes.includes("DG Grupo") && nomes.includes("Roaming/Gank"));
  assert(!nomes.includes("Guerra de Facção"));
  assertEquals(atividadesDasAreas([]).length, 18); // sem área = todas
});

Deno.test("config: toda atividade de ATIVIDADES_POR_AREA existe na lista do criador", () => {
  const todas = new Set(atividadesDasAreas([]).map((a) => a.value));
  for (const [area, lista] of Object.entries(ATIVIDADES_POR_AREA)) {
    for (const a of lista) assert(todas.has(a), `"${a}" (área ${area}) não existe em ATIVIDADES`);
  }
});

Deno.test("config: toda atividade pertence a pelo menos uma área (nenhuma fica inalcançável)", () => {
  const cobertas = new Set(Object.values(ATIVIDADES_POR_AREA).flat());
  for (const a of atividadesDasAreas([])) {
    assert(cobertas.has(a.value), `"${a.value}" não aparece em nenhuma área`);
  }
});

Deno.test("wizard: respeita o máximo de atividades e classes e remove repetidos", () => {
  let e = estadoInicial();
  e = aplicarSelecao(e, "atividades", Array(10).fill("DG Grupo"));
  assertEquals(e.atividades, ["DG Grupo"]);
  e = aplicarSelecao(e, "areas", ["PVE", "PVP", "FAC", "AVALON"]);
  e = aplicarSelecao(e, "classes", ["TANK", "DPS", "SCOUT", "PRISMA", "NATUREZA"]);
  assertEquals(e.classes.length, MAX_CLASSES);
  e = aplicarSelecao(e, "atividades", [
    "DG Grupo", "DG Fixa", "Caçada", "Guerra de Facção", "Roaming/Gank", "Apagas", "Spec de arma",
  ]);
  assertEquals(e.atividades.length, MAX_ATIVIDADES);
});

Deno.test("wizard: tier e duração inválidos mantêm o valor anterior", () => {
  let e = aplicarSelecao(estadoInicial(), "tier", ["T6"]);
  e = aplicarSelecao(e, "tier", ["T99"]);
  assertEquals(e.tier, "T6");
  e = aplicarSelecao(e, "duracao", ["240"]);
  assertEquals(e.duracaoMin, 240);
  e = aplicarSelecao(e, "duracao", ["7"]);
  assertEquals(e.duracaoMin, 240);
});

Deno.test("lerEstado: JSON corrompido do banco recomeça do zero, sem quebrar", () => {
  assertEquals(lerEstado(null), estadoInicial());
  assertEquals(lerEstado("lixo"), estadoInicial());
  assertEquals(lerEstado({ atividades: "nao-e-lista", classes: [1, 2], tier: 9, areas: 5 }), estadoInicial());
  const bom = lerEstado({ areas: ["PVE"], atividades: ["DG Grupo"], classes: ["TANK"], tier: "T7", duracaoMin: 60 });
  assertEquals(bom, { areas: ["PVE"], atividades: ["DG Grupo"], classes: ["TANK"], tier: "T7", duracaoMin: 60 });
});

Deno.test("lerEstado: estado antigo sem áreas (de antes da mudança) continua legível", () => {
  const velho = lerEstado({ atividades: ["DG Grupo"], classes: ["TANK"], tier: "T7", duracaoMin: 60 });
  assertEquals(velho.areas, []);
  assertEquals(velho.atividades, ["DG Grupo"]);
});

Deno.test("calcularExpiracao: soma os minutos", () => {
  assertEquals(calcularExpiracao(1_000_000, 120).getTime(), 1_000_000 + 120 * 60_000);
});

const AGORA = Date.UTC(2026, 9, 19, 12, 0, 0);

Deno.test("controle: sem disponibilidade mostra ⚪ e desabilita 'Sair da lista'", () => {
  const { embed, components } = montarControle(null, AGORA);
  assert(embed.description!.includes("não está na lista"));
  const botoes = components[0].components;
  assertEquals("label" in botoes[0] && botoes[0].label, "Ficar disponível");
  assertEquals("disabled" in botoes[1] && botoes[1].disabled, true);
});

Deno.test("controle: disponível mostra os dados, vira 'Alterar' e habilita sair", () => {
  const { embed, components } = montarControle(
    { areas: ["PVE"], atividades: ["DG Grupo"], classes: ["BADÔNICO"], tier: "T7", expiraEm: AGORA + 3_600_000 },
    AGORA,
  );
  assert(embed.description!.includes("Disponível"));
  assert(embed.description!.includes("PVE")); // área
  assert(embed.description!.includes("BADÔNICO"));
  assert(embed.description!.includes("T7"));
  const botoes = components[0].components;
  assertEquals("label" in botoes[0] && botoes[0].label, "Alterar");
  assertEquals("disabled" in botoes[1] && botoes[1].disabled, false);
});

Deno.test("controle: disponibilidade já vencida é tratada como 'não está na lista'", () => {
  const { embed } = montarControle(
    { areas: ["PVE"], atividades: ["DG Grupo"], classes: ["TANK"], tier: "T6", expiraEm: AGORA - 1000 },
    AGORA,
  );
  assert(embed.description!.includes("não está na lista"));
});

Deno.test("controle: nunca mostra nick nem menção de usuário", () => {
  const { embed } = montarControle(null, AGORA);
  assert(!/<@!?\d+>/.test(JSON.stringify(embed)));
});

Deno.test("controle: o candidato não vê nenhum código nem 'Candidato #...' seu", () => {
  const { embed } = montarControle(null, AGORA);
  assert(!/Candidato\s*#|#[A-Z0-9]{3}\b/.test(embed.description!));
  assert(embed.description!.includes("sem nome, sem nick e sem nenhum código"));
});
