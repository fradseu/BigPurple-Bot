import { assert, assertEquals } from "@std/assert";
import {
  agregarVagaComJogador,
  MAX_VAGAS_PT,
  preencherVagaComJogador,
  substituirVagaComJogador,
} from "./preenchimento.ts";

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

// ---------------------------------------------------------------- agregar / substituir

Deno.test("agregar: cria uma vaga NOVA já ocupada, sem mexer nas outras, e atualiza o resumo", () => {
  const r = agregarVagaComJogador(LINHAS, "111111111111111111", "<:x:9> FURA-BRUMA");
  assert(r.ok);
  assert(r.linhas.includes("(1/1) <:x:9> FURA-BRUMA <@111111111111111111> "));
  assertEquals(r.linhas[0], "📊 **Vagas:** (2/5)"); // era 1/4, ganhou 1 vaga e 1 ocupante
  assertEquals(r.linhas.filter((l) => l.startsWith("(0/1)")).length, 3); // as livres continuam livres
});

Deno.test("agregar: não duplica quem já está na PT", () => {
  assertEquals(agregarVagaComJogador(LINHAS, "999999999999999999", "FURA-BRUMA"), { ok: false, motivo: "ja_na_pt" });
});

Deno.test("agregar: respeita o teto de vagas da PT", () => {
  const cheia = Array.from({ length: MAX_VAGAS_PT }, () => "(0/1) TANK ");
  assertEquals(agregarVagaComJogador(cheia, "111111111111111111", "SCOUT"), { ok: false, motivo: "limite_vagas" });
  const quaseCheia = Array.from({ length: MAX_VAGAS_PT - 1 }, () => "(0/1) TANK ");
  assert(agregarVagaComJogador(quaseCheia, "111111111111111111", "SCOUT").ok);
});

Deno.test("substituir: apaga UMA vaga livre da função indicada e cria a nova — o tamanho NÃO muda", () => {
  const r = substituirVagaComJogador(LINHAS, "111111111111111111", "<:x:9> FURA-BRUMA", "MAIN HEALER");
  assert(r.ok);
  assert(!r.linhas.some((l) => l.includes("MAIN HEALER")), "a vaga livre indicada devia sumir");
  assert(r.linhas.includes("(1/1) <:x:9> FURA-BRUMA <@111111111111111111> "));
  assertEquals(r.linhas[0], "📊 **Vagas:** (2/4)"); // continua 4 vagas
});

Deno.test("substituir: com 2 vagas livres da mesma função, apaga só UMA", () => {
  const r = substituirVagaComJogador(LINHAS, "111111111111111111", "FURA-BRUMA", "BADÔNICO");
  assert(r.ok);
  assertEquals(r.linhas.filter((l) => l.includes("BADÔNICO")).length, 1);
});

Deno.test("substituir: NUNCA apaga vaga ocupada — se a indicada foi ocupada, falha", () => {
  // TANK está ocupada por <@999...>; não pode ser a vaga a remover
  assertEquals(
    substituirVagaComJogador(LINHAS, "111111111111111111", "FURA-BRUMA", "TANK"),
    { ok: false, motivo: "vaga_a_remover_ocupada" },
  );
});

Deno.test("substituir: função inexistente na PT também falha (não adivinha)", () => {
  assertEquals(
    substituirVagaComJogador(LINHAS, "111111111111111111", "FURA-BRUMA", "SCOUT"),
    { ok: false, motivo: "vaga_a_remover_ocupada" },
  );
});

Deno.test("substituir: não duplica quem já está na PT", () => {
  assertEquals(
    substituirVagaComJogador(LINHAS, "999999999999999999", "FURA-BRUMA", "BADÔNICO"),
    { ok: false, motivo: "ja_na_pt" },
  );
});

Deno.test("agregar e substituir não alteram o array original (puras)", () => {
  const copia = [...LINHAS];
  agregarVagaComJogador(LINHAS, "111111111111111111", "X");
  substituirVagaComJogador(LINHAS, "111111111111111111", "X", "MAIN HEALER");
  assertEquals(LINHAS, copia);
});

