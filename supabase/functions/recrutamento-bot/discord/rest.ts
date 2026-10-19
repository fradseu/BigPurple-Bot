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
