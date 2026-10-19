// rest.ts - Wrapper fino sobre a API REST do Discord.
// Sem discord.js: tudo aqui é fetch() cru contra https://discord.com/api/v10.
// Usado pra qualquer coisa que precise acontecer DEPOIS da resposta imediata
// da interação (editar a mensagem do painel, criar tópico, buscar membro/emoji).

import { ActionRowComponent, DiscordEmbed } from "./types.ts";

const API_BASE = "https://discord.com/api/v10";

function token(): string {
  const t = Deno.env.get("DISCORD_TOKEN");
  if (!t) throw new Error("DISCORD_TOKEN não configurado nos secrets da function");
  return t;
}

async function discordFetch(path: string, init: RequestInit = {}): Promise<Response> {
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers: {
      Authorization: `Bot ${token()}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  if (!res.ok) {
    const corpo = await res.text().catch(() => "");
    throw new Error(`Discord REST ${init.method ?? "GET"} ${path} -> ${res.status}: ${corpo}`);
  }

  return res;
}

export interface EditarMensagemPayload {
  content?: string;
  components?: ActionRowComponent[];
  embeds?: DiscordEmbed[];
}

// Edita uma mensagem qualquer do canal (equivalente a interaction.message.edit()).
export async function editarMensagem(
  canalId: string,
  mensagemId: string,
  payload: EditarMensagemPayload,
): Promise<void> {
  await discordFetch(`/channels/${canalId}/messages/${mensagemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Envia uma mensagem nova num canal/tópico (equivalente a channel.send()).
export async function enviarMensagem(
  canalId: string,
  payload: EditarMensagemPayload,
): Promise<{ id: string; content: string }> {
  const res = await discordFetch(`/channels/${canalId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json();
}

// Cria um tópico "solo" (sem mensagem inicial) num canal de texto.
// type: 11 = PUBLIC_THREAD. auto_archive_duration em minutos.
export async function criarTopico(
  canalPaiId: string,
  nome: string,
  autoArchiveDuration = 1440,
): Promise<{ id: string }> {
  const res = await discordFetch(`/channels/${canalPaiId}/threads`, {
    method: "POST",
    body: JSON.stringify({
      name: nome.slice(0, 100),
      type: 11,
      auto_archive_duration: autoArchiveDuration,
    }),
  });
  return res.json();
}

// Cria um canal de voz num servidor. type: 2 = GUILD_VOICE. `parentId`
// (opcional) coloca o canal dentro de uma categoria específica.
export async function criarCanalVoz(
  guildId: string,
  nome: string,
  parentId?: string,
): Promise<{ id: string }> {
  const res = await discordFetch(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({
      name: nome.slice(0, 100),
      type: 2,
      ...(parentId ? { parent_id: parentId } : {}),
    }),
  });
  return res.json();
}

// Apaga um canal (usado pra fechar a sala de voz).
export async function apagarCanal(canalId: string): Promise<void> {
  await discordFetch(`/channels/${canalId}`, { method: "DELETE" });
}

export interface CanalGuilda {
  id: string;
  name: string;
  type: number;
}

export async function listarCanaisDaGuilda(guildId: string): Promise<CanalGuilda[]> {
  const res = await discordFetch(`/guilds/${guildId}/channels`);
  return res.json();
}

// type: 4 = GUILD_CATEGORY.
export async function criarCategoria(guildId: string, nome: string): Promise<{ id: string }> {
  const res = await discordFetch(`/guilds/${guildId}/channels`, {
    method: "POST",
    body: JSON.stringify({ name: nome.slice(0, 100), type: 4 }),
  });
  return res.json();
}

// Acha a categoria pelo nome (sem diferenciar maiúsculas/minúsculas); se não
// existir, cria. Assim toda sala de voz de PT nasce sempre no mesmo lugar,
// sem precisar guardar/configurar nenhum ID de categoria.
export async function obterOuCriarCategoria(guildId: string, nome: string): Promise<string> {
  const canais = await listarCanaisDaGuilda(guildId);
  const existente = canais.find(
    (c) => c.type === 4 && c.name.toLowerCase() === nome.toLowerCase(),
  );
  if (existente) return existente.id;

  const nova = await criarCategoria(guildId, nome);
  return nova.id;
}

// Edita a resposta original de uma interação (a mensagem criada pelo
// deferredReply/reply inicial) — usa o webhook da própria interação, não
// precisa saber o id da mensagem.
export async function editarRespostaOriginal(
  applicationId: string,
  interactionToken: string,
  payload: EditarMensagemPayload,
): Promise<void> {
  await discordFetch(`/webhooks/${applicationId}/${interactionToken}/messages/@original`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Manda uma mensagem de acompanhamento pra mesma interação (equivalente a
// interaction.followUp()) — usado pra avisos de erro depois de um deferUpdate.
export async function enviarFollowUp(
  applicationId: string,
  interactionToken: string,
  payload: EditarMensagemPayload & { flags?: number },
): Promise<void> {
  await discordFetch(`/webhooks/${applicationId}/${interactionToken}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}

export interface MembroDiscord {
  user: { id: string; username: string; global_name?: string | null };
  nick?: string | null;
}

// Busca o apelido/nome real do jogador no servidor (equivalente a
// guild.members.fetch()). Se falhar (jogador saiu do servidor), retorna null.
export async function buscarMembro(
  guildId: string,
  userId: string,
): Promise<MembroDiscord | null> {
  try {
    const res = await discordFetch(`/guilds/${guildId}/members/${userId}`);
    return res.json();
  } catch {
    return null;
  }
}

export function nomeExibicaoMembro(membro: MembroDiscord | null, fallbackId: string): string {
  if (!membro) return fallbackId;
  return membro.nick ?? membro.user.global_name ?? membro.user.username;
}

export interface EmojiGuilda {
  id: string;
  name: string;
  animated?: boolean;
}

// Busca os emojis customizados do servidor (equivalente ao client.emojis.cache
// do v1, mas sob demanda em vez de resolvido no boot — não existe "boot" aqui).
export async function buscarEmojisDaGuilda(guildId: string): Promise<EmojiGuilda[]> {
  const res = await discordFetch(`/guilds/${guildId}/emojis`);
  return res.json();
}

// Lê uma mensagem (usado pra ler o painel de uma PT sem depender de uma interação dela).
export interface MensagemDiscord {
  id: string;
  content: string;
  components?: ActionRowComponent[];
  embeds?: DiscordEmbed[];
}

export async function buscarMensagem(canalId: string, mensagemId: string): Promise<MensagemDiscord | null> {
  try {
    const res = await discordFetch(`/channels/${canalId}/messages/${mensagemId}`);
    return await res.json();
  } catch (err) {
    // Mensagem/tópico apagado: não é erro de sistema, é "não existe mais".
    if (err instanceof Error && /-> 404/.test(err.message)) return null;
    throw err;
  }
}

// Só o necessário de um canal: o pai (se for tópico) diz a qual canal de ping a PT pertence.
export async function buscarCanal(canalId: string): Promise<{ id: string; parent_id?: string | null }> {
  const res = await discordFetch(`/channels/${canalId}`);
  return res.json();
}
