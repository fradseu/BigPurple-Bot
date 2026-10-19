import { assert, assertEquals } from "@std/assert";
import { preencherVagaComJogador } from "./preenchimento.ts";

const LINHAS = [
  "📊 **Vagas:** (1/4)",
  "",
  "(1/1) <:defensivo:1> TANK <@999999999999999999> ",
  "(0/1) <:arcolongo:2> BADÔNICO ",
  "(0/1) <:arcolongo:3> BADÔNICO ",
  "(0/1) <:curandeiro:4> MAIN HEALER ",
];

Deno.test("preenche a PRIMEIRA vaga livre da função e preserva o emoji do rótulo", () => {
  const r = preencherVagaComJogador(LINHAS, "111111111111111111", "BADÔNICO");
  assert(r.ok);
  assert(r.linhas.includes("(1/1) <:arcolongo:2> BADÔNICO <@111111111111111111> "));
  assert(r.linhas.includes("(0/1) <:arcolongo:3> BADÔNICO ")); // a segunda continua livre
});

Deno.test("atualiza o resumo de vagas (1/4 -> 2/4)", () => {
  const r = preencherVagaComJogador(LINHAS, "111111111111111111", "MAIN HEALER");
  assert(r.ok);
  assertEquals(r.linhas[0], "📊 **Vagas:** (2/4)");
});

Deno.test("acha a função mesmo com caixa/acento/hífen diferentes", () => {
  const r = preencherVagaComJogador(
    ["(0/1) <:x:1> FURA-BRUMA "],
    "111111111111111111",
    "fura-bruma",
  );
  assert(r.ok);
});

Deno.test("vaga lotada: nenhuma livre dessa função", () => {
  const r = preencherVagaComJogador(LINHAS, "111111111111111111", "TANK");
  assertEquals(r, { ok: false, motivo: "vaga_lotada" });
});

Deno.test("função que nem existe na PT conta como vaga lotada", () => {
  assertEquals(preencherVagaComJogador(LINHAS, "111111111111111111", "SCOUT"), { ok: false, motivo: "vaga_lotada" });
});

Deno.test("quem já está na PT não entra de novo", () => {
  const r = preencherVagaComJogador(LINHAS, "999999999999999999", "BADÔNICO");
  assertEquals(r, { ok: false, motivo: "ja_na_pt" });
});

Deno.test("nunca mexe na linha do criador", () => {
  const r = preencherVagaComJogador(["👑 Criador: <@1> (0/1) BADÔNICO ", "(0/1) BADÔNICO "], "222222222222222222", "BADÔNICO");
  assert(r.ok);
  assert(r.linhas.includes("👑 Criador: <@1> (0/1) BADÔNICO "));
});

Deno.test("não altera o array original (função pura)", () => {
  const copia = [...LINHAS];
  preencherVagaComJogador(LINHAS, "111111111111111111", "BADÔNICO");
  assertEquals(LINHAS, copia);
});
