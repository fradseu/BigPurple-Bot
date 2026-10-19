import { assert, assertEquals } from "@std/assert";
import {
  aplicarEmojisNoTexto,
  emojiParaComponente,
  EmojiResolvido,
  formatarClasseParaMensagem,
  parseClasseComEmoji,
} from "./emoji.ts";
import { chaveFuncao, encontrarIndiceVagaVazia, gerarLinhasDaFuncao } from "./vagas.ts";

const SEM_EMOJIS_NO_SERVIDOR = new Map<string, EmojiResolvido>();
const COM_EMOJI_DO_SERVIDOR = new Map<string, EmojiResolvido>([
  ["defensivo", { id: "123456789012345678", name: "defensivo", animated: false }],
]);

Deno.test("sem emoji customizado no servidor, usa o emoji PADRÃO do Discord (e não tag crua)", () => {
  assertEquals(formatarClasseParaMensagem(":defensivo: TRANSPORTE", SEM_EMOJIS_NO_SERVIDOR), "🛡️ TRANSPORTE");
  assertEquals(formatarClasseParaMensagem(":suporte: SUPORTE", SEM_EMOJIS_NO_SERVIDOR), "✨ SUPORTE");
  assertEquals(formatarClasseParaMensagem(":arcolongo: BADÔNICO", SEM_EMOJIS_NO_SERVIDOR), "🏹 BADÔNICO");
  assertEquals(formatarClasseParaMensagem(":curandeiro: MAIN HEALER", SEM_EMOJIS_NO_SERVIDOR), "💚 MAIN HEALER");
  assertEquals(formatarClasseParaMensagem(":lutador: DPS", SEM_EMOJIS_NO_SERVIDOR), "⚔️ DPS");
});

Deno.test("nunca sobra a tag crua nas 5 tags de função", () => {
  for (const tag of ["curandeiro", "arcolongo", "defensivo", "suporte", "lutador"]) {
    const texto = formatarClasseParaMensagem(`:${tag}: X`, SEM_EMOJIS_NO_SERVIDOR);
    assert(!/:\w+:/.test(texto), `sobrou tag crua em "${texto}"`);
  }
});

Deno.test("emoji customizado COM o mesmo nome no servidor tem prioridade", () => {
  assertEquals(
    formatarClasseParaMensagem(":defensivo: TANK", COM_EMOJI_DO_SERVIDOR),
    "<:defensivo:123456789012345678> TANK",
  );
});

Deno.test("botão e dropdown: emoji padrão vai só com o nome (sem id); customizado vai com id", () => {
  const padrao = parseClasseComEmoji(":suporte: SUPORTE", SEM_EMOJIS_NO_SERVIDOR).emoji;
  assertEquals(emojiParaComponente(padrao), { name: "✨" });
  const custom = parseClasseComEmoji(":defensivo: TANK", COM_EMOJI_DO_SERVIDOR).emoji;
  assertEquals(emojiParaComponente(custom), { id: "123456789012345678", name: "defensivo", animated: false });
  assertEquals(emojiParaComponente(null), undefined);
});

Deno.test("classe sem tag ou com tag desconhecida continua sem emoji", () => {
  assertEquals(formatarClasseParaMensagem("TANK", SEM_EMOJIS_NO_SERVIDOR), "TANK");
  assertEquals(formatarClasseParaMensagem(":inventada: TANK", SEM_EMOJIS_NO_SERVIDOR), "TANK");
});

Deno.test("aplicarEmojisNoTexto: troca tag crua por emoji padrão e NÃO mexe no que já está formatado", () => {
  assertEquals(aplicarEmojisNoTexto(":suporte: SUPORTE"), "✨ SUPORTE");
  assertEquals(
    aplicarEmojisNoTexto("<:arcolongo:123456789012345678> BADÔNICO"),
    "<:arcolongo:123456789012345678> BADÔNICO",
  );
  assertEquals(aplicarEmojisNoTexto("🛡️ TANK"), "🛡️ TANK");
  assertEquals(aplicarEmojisNoTexto(":inventada: X"), ":inventada: X");
});

Deno.test("a vaga com emoji padrão continua sendo achada como vaga livre da função", () => {
  const linhas = gerarLinhasDaFuncao(":defensivo: TRANSPORTE", 2, SEM_EMOJIS_NO_SERVIDOR);
  assertEquals(linhas, ["(0/1) 🛡️ TRANSPORTE ", "(0/1) 🛡️ TRANSPORTE "]);
  assertEquals(chaveFuncao(linhas[0]), "TRANSPORTE");
  assertEquals(encontrarIndiceVagaVazia(linhas, ":defensivo: TRANSPORTE"), 0);
  assertEquals(encontrarIndiceVagaVazia(linhas, "TRANSPORTE"), 0);
});

Deno.test("PT antiga (emoji do servidor antigo) e PT nova (emoji padrão) casam a mesma função", () => {
  const antiga = "(0/1) <:defensivo:1417684507510968350> TRANSPORTE ";
  const nova = "(0/1) 🛡️ TRANSPORTE ";
  assertEquals(chaveFuncao(antiga), chaveFuncao(nova));
});
