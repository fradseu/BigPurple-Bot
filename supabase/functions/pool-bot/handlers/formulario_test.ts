import { assert, assertEquals } from "@std/assert";
import { ButtonComponent, ComponentType, StringSelectComponent } from "../discord/types.ts";
import { aplicarSelecao, estadoInicial } from "../domain/wizard.ts";
import { montarFormulario, montarRevisao } from "./formulario.ts";

const selects = (tela: ReturnType<typeof montarFormulario>) =>
  tela.components.flatMap((l) => l.components).filter((c): c is StringSelectComponent =>
    c.type === ComponentType.StringSelect
  );
const botoes = (tela: ReturnType<typeof montarFormulario>) =>
  tela.components.flatMap((l) => l.components).filter((c): c is ButtonComponent => c.type === ComponentType.Button);

function completo() {
  let e = aplicarSelecao(estadoInicial(), "areas", ["PVE"]);
  e = aplicarSelecao(e, "atividades", ["DG Grupo"]);
  e = aplicarSelecao(e, "classes", ["BADÔNICO"]);
  return aplicarSelecao(e, "tier", ["T7"]);
}

Deno.test("limites do Discord: no máximo 5 linhas e 25 opções por lista, nas DUAS telas", () => {
  for (const tela of [montarFormulario(estadoInicial()), montarRevisao(completo())]) {
    assert(tela.components.length <= 5, `${tela.components.length} linhas (máx. 5)`);
    for (const l of tela.components) assert(l.components.length <= 5);
  }
  for (const s of selects(montarFormulario(estadoInicial()))) {
    assert(s.options.length <= 25, `${s.custom_id} tem ${s.options.length} opções`);
    assert((s.max_values ?? 1) <= s.options.length);
  }
});

Deno.test("tela de escolher: 4 listas e o botão Revisar começa desabilitado", () => {
  const tela = montarFormulario(estadoInicial());
  assertEquals(selects(tela).map((s) => s.custom_id), [
    "pool_sel:areas",
    "pool_sel:atividades",
    "pool_sel:classes",
    "pool_sel:tier",
  ]);
  const revisar = botoes(tela).find((b) => b.custom_id === "pool_revisar")!;
  assertEquals(revisar.disabled, true);
});

Deno.test("tela de escolher: Revisar habilita quando área, atividade, classe e tier estão escolhidos", () => {
  const revisar = botoes(montarFormulario(completo())).find((b) => b.custom_id === "pool_revisar")!;
  assertEquals(revisar.disabled, false);
});

Deno.test("tela de escolher: a lista de atividades acompanha as áreas escolhidas", () => {
  const todas = selects(montarFormulario(estadoInicial())).find((s) => s.custom_id === "pool_sel:atividades")!;
  const soFac = selects(montarFormulario(aplicarSelecao(estadoInicial(), "areas", ["FAC"])))
    .find((s) => s.custom_id === "pool_sel:atividades")!;
  assertEquals(todas.options.length, 16);
  assertEquals(soFac.options.map((o) => o.value).sort(), ["Aliança Guerra de Facção", "Guerra de Facção"]);
});

Deno.test("escolhas voltam marcadas (default) ao redesenhar — senão a lista parece zerar", () => {
  const sel = selects(montarFormulario(completo()));
  const marcadas = (id: string) => sel.find((s) => s.custom_id === id)!.options.filter((o) => o.default).map((o) => o.value);
  assertEquals(marcadas("pool_sel:areas"), ["PVE"]);
  assertEquals(marcadas("pool_sel:atividades"), ["DG Grupo"]);
  assertEquals(marcadas("pool_sel:classes"), ["BADÔNICO"]);
  assertEquals(marcadas("pool_sel:tier"), ["T7"]);
});

Deno.test("tela de revisão: 4 durações, a escolhida destacada, Voltar/Confirmar/Cancelar", () => {
  const tela = montarRevisao(aplicarSelecao(completo(), "duracao", ["240"]));
  const ids = botoes(tela).map((b) => b.custom_id);
  assertEquals(ids, ["pool_dur:60", "pool_dur:120", "pool_dur:240", "pool_dur:480", "pool_voltar", "pool_confirmar", "pool_cancelar"]);
  const destacado = botoes(tela).filter((b) => b.custom_id?.startsWith("pool_dur:") && b.style === 3);
  assertEquals(destacado.map((b) => b.custom_id), ["pool_dur:240"]);
});

Deno.test("tela de revisão: mostra o resumo e nunca expõe menção/nick", () => {
  const tela = montarRevisao(completo());
  const texto = tela.embeds[0].description!;
  assert(texto.includes("PVE") && texto.includes("DG Grupo") && texto.includes("BADÔNICO") && texto.includes("T7"));
  assert(!/<@!?\d+>/.test(JSON.stringify(tela)));
});
