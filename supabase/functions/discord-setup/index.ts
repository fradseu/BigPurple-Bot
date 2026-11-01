// index.ts - Function `discord-setup`: manutenção pontual do servidor via token do bot (discord-bot).
//   POST /internal/secao-ferramentas  {"guild_id"} — cria (se não existir) a categoria
//   "🟣Ferramentas Big Purple" logo abaixo de "🟣geral", só para o cargo Membro, com o canal
//   "⚔️・killboard" (Membros só leem; o bot posta). Devolve os ids.
// Protegida pelo segredo interno (public.bot_segredos 'interno').
import { discord } from "../_shared/killboard/discord.ts";
import { segredoInterno, segredosIguais } from "../_shared/killboard/segredo.ts";

const CATEGORIA = "🟣Ferramentas Big Purple";
const CANAL = "⚔️・killboard";
const DEPOIS_DE = "🟣geral";
const CARGO_MEMBRO = "Membro";
const CARGO_BOT = "BigPurple - Conteúdo v1.2";

const VER = 1024, ENVIAR = 2048, EMBED = 16384, HISTORICO = 65536, REACOES = 64, TOPICOS = 34359738368;

interface Canal { id: string; name: string; type: number; position: number; parent_id?: string | null }
interface Cargo { id: string; name: string }

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

async function secaoFerramentas(guildId: string) {
  const [canais, cargos] = await Promise.all([
    discord<Canal[]>(`/guilds/${guildId}/channels`),
    discord<Cargo[]>(`/guilds/${guildId}/roles`),
  ]);
  const membro = cargos.find((c) => c.name === CARGO_MEMBRO);
  const bot = cargos.find((c) => c.name === CARGO_BOT);
  if (!membro || !bot) throw new Error("Cargo Membro ou do bot não encontrado");

  const permissoes = [
    { id: guildId, type: 0, allow: "0", deny: String(VER) }, // @everyone não vê
    { id: membro.id, type: 0, allow: String(VER | HISTORICO | REACOES), deny: String(ENVIAR | TOPICOS) },
    { id: bot.id, type: 0, allow: String(VER | ENVIAR | EMBED | HISTORICO), deny: "0" },
  ];

  let categoria = canais.find((c) => c.type === 4 && c.name === CATEGORIA);
  if (!categoria) {
    categoria = await discord<Canal>(`/guilds/${guildId}/channels`, {
      method: "POST",
      body: JSON.stringify({ name: CATEGORIA, type: 4, permission_overwrites: permissoes }),
    });
    // Reordena as categorias pondo a nova logo depois de "🟣geral".
    const cats = canais.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);
    const i = cats.findIndex((c) => c.name === DEPOIS_DE);
    cats.splice(i >= 0 ? i + 1 : cats.length, 0, categoria);
    await discord(`/guilds/${guildId}/channels`, {
      method: "PATCH",
      body: JSON.stringify(cats.map((c, pos) => ({ id: c.id, position: pos }))),
    }).catch((e) => console.error("Reordenar categorias:", e));
  }

  let canal = canais.find((c) => c.type === 0 && c.name === CANAL && c.parent_id === categoria!.id);
  if (!canal) {
    canal = await discord<Canal>(`/guilds/${guildId}/channels`, {
      method: "POST",
      body: JSON.stringify({
        name: CANAL,
        type: 0,
        parent_id: categoria.id,
        topic: "Kills, mortes e assistências dos Membros no Albion (automático). Ranking toda segunda.",
        permission_overwrites: permissoes,
      }),
    });
  }
  return { categoria_id: categoria.id, canal_id: canal.id, cargo_membro_id: membro.id };
}

Deno.serve(async (req: Request) => {
  const caminho = new URL(req.url).pathname;
  if (req.method !== "POST" || !caminho.endsWith("/internal/secao-ferramentas")) {
    return new Response("Not Found", { status: 404 });
  }
  const esperado = await segredoInterno();
  if (!esperado || !segredosIguais(esperado, req.headers.get("x-cron-secret") ?? "")) {
    return new Response("unauthorized", { status: 401 });
  }
  try {
    const { guild_id } = await req.json().catch(() => ({})) as { guild_id?: string };
    if (!guild_id) return json({ erro: "guild_id obrigatório" }, 400);
    return json(await secaoFerramentas(guild_id));
  } catch (err) {
    return json({ erro: err instanceof Error ? err.message : String(err) }, 500);
  }
});
