// discord.ts - O mínimo da API REST do Discord que o killboard usa (fetch cru, token do bot).
import { DiscordEmbed } from "./dominio.ts";

const API = "https://discord.com/api/v10";

export async function discord<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const token = Deno.env.get("DISCORD_TOKEN");
  if (!token) throw new Error("DISCORD_TOKEN não configurado nos secrets");
  const res = await fetch(`${API}${caminho}`, {
    ...init,
    headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Discord ${init.method ?? "GET"} ${caminho} -> ${res.status}: ${await res.text()}`);
  return await res.json() as T;
}

export function postarEmbed(canalId: string, embed: DiscordEmbed): Promise<{ id: string }> {
  return discord(`/channels/${canalId}/messages`, {
    method: "POST",
    // Menções em embed não notificam; allowed_mentions vazio garante isso também no futuro.
    body: JSON.stringify({ embeds: [embed], allowed_mentions: { parse: [] } }),
  });
}

// Cargos do membro no servidor, ou null se ele saiu.
export async function cargosDoMembro(guildId: string, userId: string): Promise<string[] | null> {
  try {
    const m = await discord<{ roles: string[] }>(`/guilds/${guildId}/members/${userId}`);
    return m.roles;
  } catch {
    return null;
  }
}
