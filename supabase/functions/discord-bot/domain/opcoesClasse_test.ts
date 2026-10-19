import { assert, assertEquals } from "@std/assert";
import { SelectOption } from "../discord/types.ts";
import { EmojiResolvido } from "./emoji.ts";
import { classeDoIndice, indiceDaClasse, recalcularOpcoes, rotuloCompletoDaClasse } from "./opcoesClasse.ts";

const SEM_EMOJIS = new Map<string, EmojiResolvido>();

Deno.test("rotuloCompletoDaClasse: nome simples vira o formato do criador de conteúdo", () => {
  assertEquals(rotuloCompletoDaClasse("BADÔNICO"), ":arcolongo: BADÔNICO");
  assertEquals(rotuloCompletoDaClasse("fura-bruma"), ":arcolongo: FURA-BRUMA"); // ignora caixa
  assertEquals(rotuloCompletoDaClasse("MAIN HEALER"), ":curandeiro: MAIN HEALER");
  assertEquals(rotuloCompletoDaClasse("PRISMA"), ":lutador: PRISMA"); // a lista tem espaço sobrando no fim
  assertEquals(rotuloCompletoDaClasse("INEXISTENTE"), null);
});

Deno.test("indiceDaClasse e classeDoIndice: ida e volta pra TODAS as classes do Pool", () => {
  const todas = [
    "BADÔNICO", "CHAMA SOMBRA", "FULGURANTE", "FURA-BRUMA", "MAIN HEALER", "TANK", "DPS", "OFF TANK", "SCOUT",
    "STOPPER CALL", "SUPORTE", "TRANSPORTE", "QUEBRA REINOS", "ADAGA DE UMA MÃO", "BESTA LEVE", "CAÇA-ESPIRÍTOS",
    "CORTA CURA", "ENIGMÁTICO", "LANÇA VIROTES", "MONGE NEGRO", "NATUREZA", "PRISMA", "PT HEALER",
  ];
  for (const nome of todas) {
    const i = indiceDaClasse(nome);
    assert(i >= 0, `"${nome}" não existe na lista do criador de conteúdo`);
    assertEquals(classeDoIndice(i), nome);
    assert(String(i).length <= 2, "o índice tem que caber em 2 dígitos no custom_id");
  }
  assertEquals(indiceDaClasse("INEXISTENTE"), -1);
  assertEquals(classeDoIndice(999), null);
});

const opcao = (value: string, label: string): SelectOption => ({ value, label, emoji: { name: "🏹" } });

Deno.test("recalcularOpcoes: função nova (vaga agregada) entra no dropdown com Max 1", () => {
  const atuais = [opcao(":arcolongo: BADÔNICO", "BADÔNICO (Max 2)")];
  const linhas = ["(0/1) 🏹 BADÔNICO ", "(0/1) 🏹 BADÔNICO ", "(1/1) 🏹 FURA-BRUMA <@1> "];
  const r = recalcularOpcoes(atuais, linhas, SEM_EMOJIS);
  assertEquals(r.map((o) => o.label), ["BADÔNICO (Max 2)", "FURA-BRUMA (Max 1)"]);
  assertEquals(r[1].value, ":arcolongo: FURA-BRUMA");
});

Deno.test("recalcularOpcoes: função sem NENHUMA vaga (vaga substituída) sai do dropdown", () => {
  const atuais = [opcao(":arcolongo: BADÔNICO", "BADÔNICO (Max 1)"), opcao(":suporte: SUPORTE", "SUPORTE (Max 1)")];
  const r = recalcularOpcoes(atuais, ["(0/1) ✨ SUPORTE "], SEM_EMOJIS);
  assertEquals(r.map((o) => o.value), [":suporte: SUPORTE"]);
});

Deno.test("recalcularOpcoes: o Max N acompanha a quantidade de vagas (ocupadas e livres)", () => {
  const atuais = [opcao(":arcolongo: BADÔNICO", "BADÔNICO (Max 1)")];
  const r = recalcularOpcoes(atuais, ["(1/1) 🏹 BADÔNICO <@1> ", "(0/1) 🏹 BADÔNICO ", "(0/1) 🏹 BADÔNICO "], SEM_EMOJIS);
  assertEquals(r[0].label, "BADÔNICO (Max 3)");
});

Deno.test("recalcularOpcoes: reaproveita o emoji da opção que já existia", () => {
  const atuais = [{ value: ":arcolongo: BADÔNICO", label: "x", emoji: { id: "42", name: "arcolongo" } } as SelectOption];
  const r = recalcularOpcoes(atuais, ["(0/1) BADÔNICO "], SEM_EMOJIS);
  assertEquals(r[0].emoji, { id: "42", name: "arcolongo" });
});

Deno.test("recalcularOpcoes: ignora a linha do criador e linhas que não são vaga", () => {
  const r = recalcularOpcoes([], ["📊 **Vagas:** (0/1)", "", "👑 Criador: <@1>", "(0/1) 🏹 BADÔNICO "], SEM_EMOJIS);
  assertEquals(r.map((o) => o.value), [":arcolongo: BADÔNICO"]);
});

Deno.test("recalcularOpcoes: no máximo 25 opções (limite do Discord)", () => {
  const nomes = Array.from({ length: 23 }, (_, i) => classeDoIndice(i)!);
  const r = recalcularOpcoes([], nomes.map((n) => `(0/1) ${n} `), SEM_EMOJIS);
  assert(r.length <= 25);
  assertEquals(r.length, 23);
});
