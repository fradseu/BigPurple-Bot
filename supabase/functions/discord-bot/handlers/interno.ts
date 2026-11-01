// interno.ts - Rotas internas de manutenção (não são do Discord): segredo interno, registro dos
// slash commands e fotografia da estrutura do servidor (só leitura).
import { createClient } from "@supabase/supabase-js";
import { COMANDOS } from "../comandos.ts";

const API = "https://discord.com/api/v10";

let segredoCache: string | null = null;

// KILLBOARD_CRON_SECRET (secret da function) ou a linha 'interno' de public.bot_segredos.
// A tabela só é lida pela service role (RLS sem policies) e é a mesma que o pg_cron usa, então
// o segredo nunca precisa ir pro Git nem ser digitado no painel.
export async function segredoInterno(): Promise<string> {
  const doEnv = Deno.env.get("KILLBOARD_CRON_SECRET");
  if (doEnv) return doEnv;
  if (segredoCache) return segredoCache;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data } = await db.from("bot_segredos").select("valor").eq("nome", "interno").maybeSingle();
  segredoCache = (data as { valor: string } | null)?.valor ?? "";
  return segredoCache;
}

async function discord<T>(caminho: string, init: RequestInit = {}): Promise<T> {
  const res = await fetch(`${API}${caminho}`, {
    ...init,
    headers: { Authorization: `Bot ${Deno.env.get("DISCORD_TOKEN")}`, "Content-Type": "application/json" },
  });
  if (!res.ok) throw new Error(`Discord ${caminho} -> ${res.status}: ${await res.text()}`);
  return await res.json() as T;
}

// Registra os comandos de comandos.ts no app deste bot (descobre o id do app pelo próprio token).
export async function registrarComandos(): Promise<{ registrados: string[] }> {
  const app = await discord<{ id: string }>("/applications/@me");
  const r = await discord<Array<{ name: string }>>(`/applications/${app.id}/commands`, {
    method: "PUT",
    body: JSON.stringify(COMANDOS),
  });
  return { registrados: r.map((c) => `/${c.name}`) };
}

const TIPOS: Record<number, string> = { 0: "texto", 2: "voz", 4: "categoria", 5: "anúncios", 13: "palco", 15: "fórum", 16: "mídia" };

interface Canal {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id?: string | null;
  topic?: string | null;
  permission_overwrites?: Array<{ id: string; type: number; allow: string; deny: string }>;
}
interface Cargo { id: string; name: string; position: number; managed: boolean; permissions: string }

// Categorias, canais e cargos do servidor. Não lê mensagens nem membros.
export async function estruturaDoServidor(guildId: string) {
  const [servidor, canais, cargos] = await Promise.all([
    discord<{ name: string; approximate_member_count?: number }>(`/guilds/${guildId}?with_counts=true`),
    discord<Canal[]>(`/guilds/${guildId}/channels`),
    discord<Cargo[]>(`/guilds/${guildId}/roles`),
  ]);
  const nomeCargo = new Map(cargos.map((c) => [c.id, c.name]));
  const perms = (c: Canal) =>
    (c.permission_overwrites ?? []).map((o) => ({
      alvo: o.type === 0 ? `cargo:${nomeCargo.get(o.id) ?? o.id}` : `usuario:${o.id}`,
      allow: o.allow,
      deny: o.deny,
    }));
  const filhos = (pai: string | null) =>
    canais.filter((c) => c.type !== 4 && (c.parent_id ?? null) === pai).sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, nome: c.name, tipo: TIPOS[c.type] ?? String(c.type), topico: c.topic ?? undefined, permissoes: perms(c) }));
  return {
    servidor: servidor.name,
    membros: servidor.approximate_member_count,
    sem_categoria: filhos(null),
    categorias: canais.filter((c) => c.type === 4).sort((a, b) => a.position - b.position)
      .map((cat) => ({ id: cat.id, nome: cat.name, permissoes: perms(cat), canais: filhos(cat.id) })),
    cargos: cargos.sort((a, b) => b.position - a.position)
      .map((c) => ({ id: c.id, nome: c.name, posicao: c.position, de_bot: c.managed, permissoes: c.permissions })),
  };
}
