import { assert, assertEquals } from "@std/assert";
import { apelidoParaMembro, nomeNoJogo, traduzirErroDiscord } from "./aprovacao.ts";

Deno.test("nomeNoJogo: usa a grafia do jogo quando o dossiê achou o jogador", () => {
  const nome = nomeNoJogo({
    nickname: "felipepikito", // digitado em minúsculas
    dossie: { status: "ok", jogador: { nome: "FelipePikito" } },
  });
  assertEquals(nome, "FelipePikito");
});

Deno.test("nomeNoJogo: sem dossiê útil, usa o que a pessoa digitou", () => {
  assertEquals(nomeNoJogo({ nickname: "  Fulano ", dossie: null }), "Fulano");
  assertEquals(nomeNoJogo({ nickname: "Fulano", dossie: { status: "nao_encontrado", jogador: null } }), "Fulano");
  assertEquals(nomeNoJogo({ nickname: "Fulano", dossie: { status: "api_indisponivel", jogador: null } }), "Fulano");
});

Deno.test("nomeNoJogo: dossiê ok mas nome vazio ou de tipo errado não vira apelido vazio", () => {
  assertEquals(nomeNoJogo({ nickname: "Fulano", dossie: { status: "ok", jogador: { nome: "  " } } }), "Fulano");
  assertEquals(nomeNoJogo({ nickname: "Fulano", dossie: { status: "ok", jogador: { nome: 123 } } }), "Fulano");
  assertEquals(nomeNoJogo({ nickname: "Fulano", dossie: { status: "ok" } }), "Fulano");
});

Deno.test("apelidoParaMembro: corta em 32 caracteres (limite do Discord)", () => {
  assertEquals(apelidoParaMembro("A".repeat(40)).length, 32);
  assertEquals(apelidoParaMembro("  Curto  "), "Curto");
});

Deno.test("traduzirErroDiscord: permissão/hierarquia explica o que fazer", () => {
  const apelido = traduzirErroDiscord('Discord REST PATCH /guilds/1/members/2 -> 403: {"code": 50013}', "apelido");
  assert(apelido.includes("Gerenciar Apelidos"));
  assert(apelido.includes("dono do servidor"));

  const cargo = traduzirErroDiscord('... -> 403: {"message": "Missing Permissions", "code": 50013}', "cargo");
  assert(cargo.includes("Gerenciar Cargos"));
  assert(cargo.includes("acima"));
});

Deno.test("traduzirErroDiscord: membro que saiu e cargo apagado têm mensagens próprias", () => {
  assert(traduzirErroDiscord('-> 404: {"code": 10007, "message": "Unknown Member"}', "apelido").includes("não está mais no servidor"));
  assert(traduzirErroDiscord('-> 404: {"code": 10011, "message": "Unknown Role"}', "cargo").includes("/recrutamento-config membro"));
});

Deno.test("traduzirErroDiscord: erro desconhecido não vaza detalhe técnico", () => {
  const msg = traduzirErroDiscord("Discord REST PUT /guilds/123/members/456 -> 500: boom", "cargo");
  assert(!msg.includes("123") && !msg.includes("boom"));
});
