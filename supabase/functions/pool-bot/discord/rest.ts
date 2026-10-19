// rest.ts - Wrapper fino sobre a API REST do Discord (fetch cru, sem discord.js).
// Token PRÓPRIO: este é o terceiro app do Discord (secret POOL_DISCORD_TOKEN).
import { ActionRowComponent, AllowedMentions, DiscordEmbed } from "./types.ts";

const API_BASE = "https://discord.com/api/v10";

function token(): string {
  const t = Deno.env.get("POOL_DISCORD_TOKEN");
  if (!t) throw new Error("POOL_DISCORD_TOKEN não configurado nos secrets da function");
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

// "Unknown Channel" (10003) ou "Unknown Message" (10008): o tópico/mensagem foi
// apagado (por um moderador, por exemplo) e precisa ser recriado.
export function erroNaoEncontrado(err: unknown): boolean {
  const texto = err instanceof Error ? err.message : String(err);
  return texto.includes("10003") || texto.includes("10008") || texto.includes("-> 404");
}

export interface PayloadMensagem {
  content?: string;
  embeds?: DiscordEmbed[];
  components?: ActionRowComponent[];
  allowed_mentions?: AllowedMentions;
  flags?: number;
}

export async function enviarMensagem(canalId: string, payload: PayloadMensagem): Promise<{ id: string }> {
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

// Tópico PRIVADO (type 12) dentro do canal do pool: só enxerga quem for adicionado
// (e moderadores com "Gerenciar Tópicos"). `invitable: false` impede que os
// membros adicionem outras pessoas. 10080 min = arquiva sozinho após 7 dias sem
// uso; mandar mensagem nele de novo desarquiva.
export async function criarTopicoPrivado(canalPaiId: string, nome: string): Promise<{ id: string }> {
  const res = await discordFetch(`/channels/${canalPaiId}/threads`, {
    method: "POST",
    body: JSON.stringify({
      name: nome.slice(0, 100),
      type: 12,
      invitable: false,
      auto_archive_duration: 10080,
    }),
  });
  return res.json();
}

export async function adicionarMembroAoTopico(topicoId: string, userId: string): Promise<void> {
  await discordFetch(`/channels/${topicoId}/thread-members/${userId}`, { method: "PUT" });
}

// Apaga canal/tópico (usado pra desfazer um tópico órfão). Precisa de "Gerenciar Tópicos".
export async function apagarCanal(canalId: string): Promise<void> {
  await discordFetch(`/channels/${canalId}`, { method: "DELETE" });
}

// Apaga uma mensagem (usado pro convite sumir: aceito, recusado, expirado ou cancelado).
// Mensagem que já não existe não é erro — o objetivo (ela sumir) já foi alcançado.
export async function apagarMensagem(canalId: string, mensagemId: string): Promise<void> {
  try {
    await discordFetch(`/channels/${canalId}/messages/${mensagemId}`, { method: "DELETE" });
  } catch (err) {
    if (!erroNaoEncontrado(err)) throw err;
  }
}
