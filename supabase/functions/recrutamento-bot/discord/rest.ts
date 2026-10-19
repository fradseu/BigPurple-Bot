// rest.ts - Wrapper fino sobre a API REST do Discord (fetch cru, sem discord.js).
// Mesmo desenho do bot de conteúdo, mas com token PRÓPRIO: este é outro app
// do Discord, com outro token (secret RECRUTAMENTO_DISCORD_TOKEN).

import { ActionRowComponent, AllowedMentions, DiscordEmbed } from "./types.ts";

const API_BASE = "https://discord.com/api/v10";

function token(): string {
  const t = Deno.env.get("RECRUTAMENTO_DISCORD_TOKEN");
  if (!t) throw new Error("RECRUTAMENTO_DISCORD_TOKEN não configurado nos secrets da function");
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

export interface PayloadMensagem {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: ActionRowComponent[];
  allowed_mentions?: AllowedMentions;
  flags?: number;
}

export async function enviarMensagem(
  canalId: string,
  payload: PayloadMensagem,
): Promise<{ id: string }> {
  const res = await discordFetch(`/channels/${canalId}/messages`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
  return res.json();
}

export async function editarMensagem(
  canalId: string,
  mensagemId: string,
  payload: PayloadMensagem,
): Promise<void> {
  await discordFetch(`/channels/${canalId}/messages/${mensagemId}`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// Edita a resposta original (a "pensando..." do deferredReply) via webhook da interação.
export async function editarRespostaOriginal(
  applicationId: string,
  interactionToken: string,
  payload: PayloadMensagem,
): Promise<void> {
  await discordFetch(`/webhooks/${applicationId}/${interactionToken}/messages/@original`, {
    method: "PATCH",
    body: JSON.stringify(payload),
  });
}

// O motivo aparece no "Registro de Auditoria" do servidor ao lado da ação do bot.
// Vai num header HTTP, então precisa estar codificado (acentos/emoji quebram o header cru).
function comMotivo(motivo?: string): Record<string, string> {
  return motivo ? { "X-Audit-Log-Reason": encodeURIComponent(motivo) } : {};
}

// Muda o apelido do membro NESTE servidor (precisa de "Gerenciar Apelidos" e do
// cargo do bot acima do cargo mais alto da pessoa; o Discord nunca deixa mudar o do dono).
export async function definirApelido(
  guildId: string,
  userId: string,
  apelido: string,
  motivo?: string,
): Promise<void> {
  await discordFetch(`/guilds/${guildId}/members/${userId}`, {
    method: "PATCH",
    headers: comMotivo(motivo),
    body: JSON.stringify({ nick: apelido }),
  });
}

// Dá um cargo ao membro (precisa de "Gerenciar Cargos" e do cargo do bot ACIMA do cargo dado).
export async function adicionarCargo(
  guildId: string,
  userId: string,
  cargoId: string,
  motivo?: string,
): Promise<void> {
  await discordFetch(`/guilds/${guildId}/members/${userId}/roles/${cargoId}`, {
    method: "PUT",
    headers: comMotivo(motivo),
  });
}

// Mensagem de acompanhamento (equivalente a interaction.followUp()).
export async function enviarFollowUp(
  applicationId: string,
  interactionToken: string,
  payload: PayloadMensagem,
): Promise<void> {
  await discordFetch(`/webhooks/${applicationId}/${interactionToken}`, {
    method: "POST",
    body: JSON.stringify(payload),
  });
}
