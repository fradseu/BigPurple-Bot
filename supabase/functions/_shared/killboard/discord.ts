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
  // 204 (sem corpo) em PATCH/DELETE.
  return (res.status === 204 ? null : await res.json()) as T;
}

// `texto` (opcional) vai acima do embed. allowed_mentions vazio: as menções aparecem como @Nome,
// mas ninguém recebe notificação.
export function postarEmbed(canalId: string, embed: DiscordEmbed, texto?: string): Promise<{ id: string }> {
  return discord(`/channels/${canalId}/messages`, {
    method: "POST",
    body: JSON.stringify({ content: texto, embeds: [embed], allowed_mentions: { parse: [] } }),
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

interface MembroBusca {
  user: { id: string; username: string; global_name?: string | null };
  nick?: string | null;
  roles: string[];
}

// Procura no servidor quem usa exatamente `nome` (do jogo) como apelido, nome global ou usuário,
// sem diferenciar maiúsculas. O recrutamento já define o apelido igual ao nome do jogo.
export async function membroPeloNome(
  guildId: string,
  nome: string,
): Promise<{ id: string; roles: string[] } | null> {
  const alvo = nome.trim().toLowerCase();
  try {
    const achados = await discord<MembroBusca[]>(
      `/guilds/${guildId}/members/search?query=${encodeURIComponent(nome)}&limit=10`,
    );
    const m = achados.find((x) =>
      [x.nick, x.user.global_name, x.user.username].some((n) => n?.trim().toLowerCase() === alvo)
    );
    return m ? { id: m.user.id, roles: m.roles } : null;
  } catch {
    return null;
  }
}
