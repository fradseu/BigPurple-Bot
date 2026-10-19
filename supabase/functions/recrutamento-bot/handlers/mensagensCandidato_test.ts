import { assert, assertEquals } from "@std/assert";
import {
  mensagemCandidaturaRecebida,
  mensagemJaEmAvaliacao,
  mensagemNaoConfigurado,
} from "./mensagensCandidato.ts";

Deno.test("candidatura recebida: chama pelo nick e diz que está em avaliação", () => {
  const embed = mensagemCandidaturaRecebida("FelipePikito").embeds![0];
  assert(embed.description!.includes("FelipePikito"));
  assert(embed.description!.includes("em avaliação"));
  assertEquals(embed.fields!.find((f) => f.name.includes("Situação"))?.value, "⏳ Em avaliação");
});

Deno.test("já em avaliação: tranquiliza e pede pra não reenviar", () => {
  const embed = mensagemJaEmAvaliacao().embeds![0];
  assert(embed.description!.includes("Não precisa enviar de novo"));
});

Deno.test("não configurado: orienta o comando certo pro administrador", () => {
  assert(mensagemNaoConfigurado().content!.includes("/recrutamento-config canal"));
});

Deno.test("mensagens ao candidato nunca expõem erro técnico nem ID", () => {
  for (const m of [mensagemCandidaturaRecebida("x"), mensagemJaEmAvaliacao(), mensagemNaoConfigurado()]) {
    const texto = JSON.stringify(m);
    assert(!/stack|Error|\d{15,}/.test(texto), "texto vazou detalhe técnico");
  }
});
