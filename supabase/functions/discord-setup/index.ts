// index.ts - Function `discord-setup`: manutenção pontual do servidor via token do bot (discord-bot).
//   POST /internal/secao-ferramentas  {"guild_id"} — cria (se não existir) a categoria
//   "🟣Ferramentas Big Purple" logo abaixo de "🟣geral", só para o cargo Membro, com o canal
//   "⚔️・killboard" (Membros só leem; o bot posta). Devolve os ids.
//   POST /internal/membros  {"guild_id", "nomes"?} — membros do servidor (id, nomes, cargos), só
//   leitura. Tenta a listagem completa; se o bot não tiver a intent de membros, busca nome por nome.
//   POST /internal/dar-cargo  {"guild_id", "cargo_id", "usuarios": [...]} — adiciona um cargo usando
//   o token do bot de RECRUTAMENTO (é ele que tem "Gerenciar cargos" acima do cargo Membro).
//   POST /internal/reescrever-kills  {"guild_id"} — reescreve as mensagens já postadas no killboard
//   com o layout atual (nomes do jogo no lugar de menções), usando killboard_postados.nomes.
//   Opcional: "event_ids" (só esses) e "v" (versão da imagem, força o Discord a buscar de novo).
//   POST /internal/repostar-kills  {"guild_id"} — reposta as kills registradas a partir dos eventos
//   guardados (killboard_eventos), já com o card pronto. Não depende da API do Albion.
// Protegida pelo segredo interno (public.bot_segredos 'interno').
import { discord, postarEmbed, prepararCard } from "../_shared/killboard/discord.ts";
import { EventoAlbion, idsPorNome, montarEmbedEvento, TipoEvento, urlCard } from "../_shared/killboard/dominio.ts";
import { segredoInterno, segredosIguais } from "../_shared/killboard/segredo.ts";
import { createClient } from "@supabase/supabase-js";

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

interface Membro {
  user: { id: string; username: string; global_name?: string | null; bot?: boolean };
  nick?: string | null;
  roles: string[];
}

async function membros(guildId: string, nomes: string[]) {
  const enxuto = (m: Membro) => ({
    id: m.user.id,
    usuario: m.user.username,
    nome_global: m.user.global_name ?? null,
    apelido: m.nick ?? null,
    cargos: m.roles,
    bot: m.user.bot ?? false,
  });
  try {
    const todos = await discord<Membro[]>(`/guilds/${guildId}/members?limit=1000`);
    return { origem: "listagem", membros: todos.map(enxuto) };
  } catch (err) {
    // Sem a intent "Server Members": busca pelos 3 primeiros caracteres de cada nome.
    const vistos = new Map<string, ReturnType<typeof enxuto>>();
    for (const nome of nomes) {
      const achados = await discord<Membro[]>(
        `/guilds/${guildId}/members/search?query=${encodeURIComponent(nome.slice(0, 3))}&limit=100`,
      ).catch(() => [] as Membro[]);
      for (const m of achados) vistos.set(m.user.id, enxuto(m));
    }
    return { origem: "busca", erro_listagem: String(err), membros: [...vistos.values()] };
  }
}

async function darCargo(guildId: string, cargoId: string, usuarios: string[]) {
  const token = Deno.env.get("RECRUTAMENTO_DISCORD_TOKEN");
  if (!token) throw new Error("RECRUTAMENTO_DISCORD_TOKEN não configurado");
  const resultado: Record<string, string> = {};
  for (const u of usuarios) {
    const res = await fetch(`https://discord.com/api/v10/guilds/${guildId}/members/${u}/roles/${cargoId}`, {
      method: "PUT",
      headers: { Authorization: `Bot ${token}`, "X-Audit-Log-Reason": "Killboard: cargo Membro" },
    });
    resultado[u] = res.ok ? "ok" : `${res.status} ${await res.text()}`;
  }
  return resultado;
}

interface Postado { event_id: number; tipo: string; mensagem_id: string | null; nomes: string[] }

async function reescreverKills(guildId: string, eventIds?: number[], versao?: string) {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: cfg } = await db.from("killboard_config").select("canal_id").eq("guild_id", guildId).single();
  let consulta = db.from("killboard_postados").select("event_id, tipo, mensagem_id, nomes")
    .eq("guild_id", guildId).not("mensagem_id", "is", null);
  if (eventIds?.length) consulta = consulta.in("event_id", eventIds);
  const { data, error } = await consulta;
  if (error || !cfg) throw new Error(`Erro ao ler postados: ${error?.message}`);
  const rotulos: Record<string, string> = { kill: "Kill de", morte: "Morte de", assistencia: "Assistência de" };
  const resultado: Record<string, string> = {};
  for (const p of (data ?? []) as Postado[]) {
    try {
      const msg = await discord<{ embeds: Array<Record<string, unknown>> }>(
        `/channels/${cfg.canal_id}/messages/${p.mensagem_id}`,
      );
      const embed: Record<string, unknown> = {
        ...msg.embeds[0],
        description: `${rotulos[p.tipo]} ${p.nomes.map((n) => `**${n}**`).join(", ")}`,
        image: { url: versao ? urlCard(p.event_id).replace(/\?v=\d+$/, `?v=${versao}`) : urlCard(p.event_id) },
      };
      // Layout atual: o card de imagem substitui os campos e a miniatura. Também saem os campos
      // que o Discord devolve mas não aceita de volta.
      for (const k of ["type", "content_scan_version", "fields", "thumbnail"]) delete embed[k];
      await discord(`/channels/${cfg.canal_id}/messages/${p.mensagem_id}`, {
        method: "PATCH",
        body: JSON.stringify({ content: "", embeds: [embed], allowed_mentions: { parse: [] } }),
      });
      resultado[String(p.event_id)] = "ok";
    } catch (err) {
      resultado[String(p.event_id)] = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 1_100));
  }
  return resultado;
}

async function repostarKills(guildId: string) {
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data: cfg } = await db.from("killboard_config").select("canal_id").eq("guild_id", guildId).single();
  const { data: postados } = await db.from("killboard_postados").select("event_id, tipo, nomes").eq("guild_id", guildId);
  if (!cfg || !postados?.length) return { postados: 0 };
  const ids = (postados as Array<{ event_id: number }>).map((p) => p.event_id);
  const { data: eventos } = await db.from("killboard_eventos").select("event_id, evento").in("event_id", ids);
  const porId = new Map<number, EventoAlbion>(
    ((eventos ?? []) as Array<{ event_id: number; evento: EventoAlbion }>).map((e) => [Number(e.event_id), e.evento]),
  );

  const lista = (postados as Array<{ event_id: number; tipo: TipoEvento; nomes: string[] }>)
    .map((p) => ({ ...p, evento: porId.get(Number(p.event_id)) }))
    .filter((p) => p.evento)
    .sort((a, b) => new Date(a.evento!.TimeStamp).getTime() - new Date(b.evento!.TimeStamp).getTime());

  const resultado: Record<string, string> = {};
  for (const p of lista) {
    try {
      const evento = p.evento!;
      await prepararCard(urlCard(evento.EventId));
      const embed = montarEmbedEvento(evento, { tipo: p.tipo, membros: idsPorNome(evento, p.nomes) });
      const msg = await postarEmbed(cfg.canal_id, embed);
      await db.from("killboard_postados").update({ mensagem_id: msg.id })
        .eq("guild_id", guildId).eq("event_id", p.event_id);
      resultado[String(p.event_id)] = "ok";
    } catch (err) {
      resultado[String(p.event_id)] = err instanceof Error ? err.message : String(err);
    }
    await new Promise((r) => setTimeout(r, 1_200));
  }
  return resultado;
}

Deno.serve(async (req: Request) => {
  const caminho = new URL(req.url).pathname;
  if (req.method === "POST" && caminho.endsWith("/internal/repostar-kills")) {
    const esperado = await segredoInterno();
    if (!esperado || !segredosIguais(esperado, req.headers.get("x-cron-secret") ?? "")) {
      return new Response("unauthorized", { status: 401 });
    }
    const { guild_id } = await req.json().catch(() => ({})) as { guild_id?: string };
    if (!guild_id) return json({ erro: "guild_id obrigatório" }, 400);
    try {
      return json(await repostarKills(guild_id));
    } catch (err) {
      return json({ erro: err instanceof Error ? err.message : String(err) }, 500);
    }
  }
  if (req.method === "POST" && caminho.endsWith("/internal/reescrever-kills")) {
    const esperado = await segredoInterno();
    if (!esperado || !segredosIguais(esperado, req.headers.get("x-cron-secret") ?? "")) {
      return new Response("unauthorized", { status: 401 });
    }
    const { guild_id, event_ids, v } = await req.json().catch(() => ({})) as {
      guild_id?: string;
      event_ids?: number[];
      v?: string;
    };
    if (!guild_id) return json({ erro: "guild_id obrigatório" }, 400);
    try {
      return json(await reescreverKills(guild_id, event_ids, v));
    } catch (err) {
      return json({ erro: err instanceof Error ? err.message : String(err) }, 500);
    }
  }
  if (req.method === "POST" && caminho.endsWith("/internal/dar-cargo")) {
    const esperado = await segredoInterno();
    if (!esperado || !segredosIguais(esperado, req.headers.get("x-cron-secret") ?? "")) {
      return new Response("unauthorized", { status: 401 });
    }
    const b = await req.json().catch(() => ({})) as { guild_id?: string; cargo_id?: string; usuarios?: string[] };
    if (!b.guild_id || !b.cargo_id || !b.usuarios?.length) return json({ erro: "guild_id, cargo_id e usuarios" }, 400);
    try {
      return json(await darCargo(b.guild_id, b.cargo_id, b.usuarios));
    } catch (err) {
      return json({ erro: err instanceof Error ? err.message : String(err) }, 500);
    }
  }
  if (req.method === "POST" && caminho.endsWith("/internal/membros")) {
    const esperado = await segredoInterno();
    if (!esperado || !segredosIguais(esperado, req.headers.get("x-cron-secret") ?? "")) {
      return new Response("unauthorized", { status: 401 });
    }
    const { guild_id, nomes } = await req.json().catch(() => ({})) as { guild_id?: string; nomes?: string[] };
    if (!guild_id) return json({ erro: "guild_id obrigatório" }, 400);
    try {
      return json(await membros(guild_id, nomes ?? []));
    } catch (err) {
      return json({ erro: err instanceof Error ? err.message : String(err) }, 500);
    }
  }
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
