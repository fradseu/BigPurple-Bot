// emoji.ts - Resolve as tags (":arcolongo:", ":curandeiro:" etc) dos nomes de
// classe pros emojis customizados de verdade do servidor.
//
// Diferença chave em relação ao v1: lá isso era resolvido uma vez no boot do
// processo (que ficava vivo 24/7) e guardado num Map global. Aqui não existe
// "boot" — cada handler que precisa disso busca os emojis do servidor via
// REST (discord/rest.ts -> buscarEmojisDaGuilda) e monta o mapa na hora,
// através de montarMapaEmojis().

import { EMOJIS_UNICODE_FUNCAO } from "../config.ts";
import { EmojiGuilda } from "../discord/rest.ts";
import { DiscordEmoji } from "../discord/types.ts";

export interface EmojiResolvido {
  id: string;
  name: string;
  animated: boolean;
  // true = emoji PADRÃO do Discord (ex: "🛡️"): `name` é o próprio caractere e não há `id`.
  unicode?: boolean;
}

// Monta o mapa nome-da-tag -> emoji real, a partir dos emojis do servidor
// (busca por NOME, ex: um emoji chamado "arcolongo" no servidor).
export function montarMapaEmojis(emojisGuilda: EmojiGuilda[]): Map<string, EmojiResolvido> {
  const mapa = new Map<string, EmojiResolvido>();
  for (const emoji of emojisGuilda) {
    if (!emoji.name) continue;
    mapa.set(emoji.name.toLowerCase(), {
      id: emoji.id,
      name: emoji.name,
      animated: Boolean(emoji.animated),
    });
  }
  return mapa;
}

interface ClasseParseada {
  nome: string;
  emoji: EmojiResolvido | null;
}

// Separa a tag (ex: ":arcolongo:") do nome da classe (ex: "BADÔNICO") e resolve
// o emoji correspondente: 1º tenta pelo nome real no servidor (emoji customizado),
// 2º cai pro emoji PADRÃO do Discord cadastrado em config.ts (EMOJIS_UNICODE_FUNCAO).
export function parseClasseComEmoji(
  classe: string,
  emojisResolvidos: Map<string, EmojiResolvido>,
): ClasseParseada {
  const match = classe.match(/^:(\w+):\s*(.+)$/);
  if (!match) return { nome: classe.trim(), emoji: null };
  const [, tag, nomeBruto] = match;
  const nome = nomeBruto.trim();

  const real = emojisResolvidos.get(tag.toLowerCase());
  if (real) return { nome, emoji: real };

  const padrao = EMOJIS_UNICODE_FUNCAO[tag.toLowerCase()];
  if (!padrao) return { nome, emoji: null };

  return { nome, emoji: { id: "", name: padrao, animated: false, unicode: true } };
}

// Texto pronto pra ir DENTRO do conteúdo da mensagem (sintaxe <:tag:id> do
// Discord). Sem emoji resolvido, mostra só o nome limpo — nunca a tag crua.
export function formatarClasseParaMensagem(
  classe: string,
  emojisResolvidos: Map<string, EmojiResolvido>,
): string {
  const { nome, emoji } = parseClasseComEmoji(classe, emojisResolvidos);
  if (!emoji) return nome;
  if (emoji.unicode) return `${emoji.name} ${nome}`; // emoji padrão: o próprio caractere
  return `<${emoji.animated ? "a" : ""}:${emoji.name}:${emoji.id}> ${nome}`;
}

// Emoji no formato que a API do Discord espera em botões/opções de dropdown
// (campo `emoji: {id, name, animated}` separado do label, não dentro do texto).
export function emojiParaComponente(emoji: EmojiResolvido | null): DiscordEmoji | undefined {
  if (!emoji) return undefined;
  if (emoji.unicode) return { name: emoji.name }; // emoji padrão não tem id
  return { id: emoji.id, name: emoji.name, animated: emoji.animated };
}

// Ordem de exibição dos grupos de classe, do topo pra baixo. Tag que não
// estiver aqui (não deveria acontecer) vai pro final.
const ORDEM_GRUPOS: Record<string, number> = {
  defensivo: 0,
  curandeiro: 1,
  suporte: 2,
  arcolongo: 3,
  lutador: 4,
};

// Ordena classes primeiro por grupo (tag), depois alfabeticamente pelo nome
// dentro do grupo. Usado em toda lista de classes (Passo 3, dropdown de
// foco, lista final de vagas) pra ficar sempre na mesma ordem consistente.
export function compararClasses(a: string, b: string): number {
  const matchA = a.match(/^:(\w+):\s*(.+)$/);
  const matchB = b.match(/^:(\w+):\s*(.+)$/);
  const [tagA, nomeA] = matchA ? [matchA[1].toLowerCase(), matchA[2].trim()] : ["", a];
  const [tagB, nomeB] = matchB ? [matchB[1].toLowerCase(), matchB[2].trim()] : ["", b];

  const ordemA = ORDEM_GRUPOS[tagA] ?? 99;
  const ordemB = ORDEM_GRUPOS[tagB] ?? 99;
  if (ordemA !== ordemB) return ordemA - ordemB;

  return nomeA.localeCompare(nomeB, "pt-BR");
}

// Rede de segurança: varre um texto inteiro e troca QUALQUER tag ":algo:" conhecida
// (EMOJIS_UNICODE_FUNCAO) pelo emoji padrão do Discord. Roda
// bem antes de qualquer envio/edição de mensagem, garantindo que nenhuma tag
// crua sobre no painel, venha o texto de onde vier.
//
// ⚠️ Cuidado: um "<:algo:id>" já formatado CONTÉM o texto ":algo:" dentro
// dele. Sem a primeira alternativa do regex abaixo, essa função reprocessava
// o que já estava certo e duplicava/corrompia (ex: "<<:algo:id>id>"), o que
// também quebrava a comparação de vaga vazia (chaveFuncao não reconhecia o
// resultado corrompido, dando falso "vaga já lotada").
export function aplicarEmojisNoTexto(texto: string): string {
  return texto.replace(/<a?:\w+:\d+>|:(\w+):/g, (match, tagCrua) => {
    if (tagCrua === undefined) return match; // já é <a?:tag:id> válido, não mexe

    // Sobrou uma tag crua (":defensivo:"): troca pelo emoji padrão do Discord.
    return EMOJIS_UNICODE_FUNCAO[tagCrua.toLowerCase()] ?? match;
  });
}
