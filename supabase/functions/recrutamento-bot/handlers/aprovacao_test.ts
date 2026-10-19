import { assert } from "@std/assert";
import { ResultadoAprovacao, resumoDaAplicacao } from "./aprovacao.ts";

const base: ResultadoAprovacao = {
  apelido: "FelipePikito",
  apelidoAplicado: true,
  cargoAplicado: true,
  caixa: "criada",
  avisos: [],
};

Deno.test("rodapé da aprovação: tudo certo mostra ✔ nos três itens", () => {
  const t = resumoDaAplicacao(base);
  assert(t.includes("Apelido “FelipePikito” ✔"));
  assert(t.includes("Cargo Membro ✔"));
  assert(t.includes("Caixa do Pool ✔"));
});

Deno.test("rodapé: caixa que já existia também conta como ✔", () => {
  assert(resumoDaAplicacao({ ...base, caixa: "ja_existia" }).includes("Caixa do Pool ✔"));
});

Deno.test("rodapé: servidor sem Pool mostra — (não é erro)", () => {
  const t = resumoDaAplicacao({ ...base, caixa: "sem_pool" });
  assert(t.includes("Caixa do Pool —"));
  assert(!t.includes("✖"));
});

Deno.test("rodapé: falha ao criar a caixa mostra ✖ sem esconder o que deu certo", () => {
  const t = resumoDaAplicacao({ ...base, caixa: "erro" });
  assert(t.includes("Caixa do Pool ✖"));
  assert(t.includes("Apelido “FelipePikito” ✔") && t.includes("Cargo Membro ✔"));
});

Deno.test("rodapé: cada item falha de forma independente", () => {
  const t = resumoDaAplicacao({ ...base, apelidoAplicado: false, cargoAplicado: null, caixa: "criada" });
  assert(t.includes("Apelido “FelipePikito” ✖") && t.includes("Cargo Membro —") && t.includes("Caixa do Pool ✔"));
});
