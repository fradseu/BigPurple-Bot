// db.ts - Acesso ao banco do killboard. Usa um cliente sem tipagem de schema (as tabelas
// do recrutamento e do retrato da guilda são de outras functions e não estão no Database deste bot).
import { createClient } from "@supabase/supabase-js";
import { LinhaRanking, TipoEvento } from "./dominio.ts";

export interface ConfigKillboard {
  guild_id: string;
  canal_id: string;
  cargo_membro_id: string | null;
  albion_guild_id: string | null;
  ativo: boolean;
  ativado_em: string;
}

let cliente: ReturnType<typeof createClient> | null = null;
function db() {
  if (!cliente) {
    cliente = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
  }
  return cliente;
}

export async function lerConfigsAtivas(): Promise<ConfigKillboard[]> {
  const { data, error } = await db().from("killboard_config").select().eq("ativo", true);
  if (error) throw new Error(`Erro ao ler killboard_config: ${error.message}`);
  return (data ?? []) as ConfigKillboard[];
}

export async function lerConfig(guildId: string): Promise<ConfigKillboard | null> {
  const { data, error } = await db().from("killboard_config").select().eq("guild_id", guildId).maybeSingle();
  if (error) throw new Error(`Erro ao ler killboard_config: ${error.message}`);
  return (data as ConfigKillboard | null) ?? null;
}

export async function ativar(
  guildId: string,
  canalId: string,
  cargoId: string | null,
  porQuem: string,
): Promise<void> {
  const { error } = await db().from("killboard_config").upsert({
    guild_id: guildId,
    canal_id: canalId,
    cargo_membro_id: cargoId,
    ativo: true,
    ativado_em: new Date().toISOString(),
    atualizado_por: porQuem,
    atualizado_em: new Date().toISOString(),
  });
  if (error) throw new Error(`Erro ao salvar killboard_config: ${error.message}`);
}

export async function desativar(guildId: string, porQuem: string): Promise<boolean> {
  const { data, error } = await db().from("killboard_config")
    .update({ ativo: false, atualizado_por: porQuem, atualizado_em: new Date().toISOString() })
    .eq("guild_id", guildId).select("guild_id");
  if (error) throw new Error(`Erro ao desativar killboard: ${error.message}`);
  return (data ?? []).length > 0;
}

// Cargo de Membro configurado no recrutamento (usado quando o killboard não define um próprio).
export async function cargoMembroDoRecrutamento(guildId: string): Promise<string | null> {
  const { data } = await db().from("recrutamento_config").select("cargo_membro_id")
    .eq("guild_id", guildId).maybeSingle();
  return (data as { cargo_membro_id: string | null } | null)?.cargo_membro_id ?? null;
}

// Guilda do Albion: a configurada ou, se nenhuma, a primeira cadastrada no retrato diário.
export async function guildaAlbion(id: string | null): Promise<{ id: string; nome: string } | null> {
  let q = db().from("guilda_albion").select("albion_guild_id, nome");
  if (id) q = q.eq("albion_guild_id", id);
  const { data } = await q.limit(1).maybeSingle();
  const g = data as { albion_guild_id: string; nome: string } | null;
  return g ? { id: g.albion_guild_id, nome: g.nome } : null;
}

// player_id do Albion -> discord_user_id. Fontes, da mais forte pra mais fraca: tabela
// membros_vinculo (recrutamento, similaridade ou manual) e candidaturas aprovadas (as antigas,
// de antes da tabela). Se a mesma pessoa foi aprovada mais de uma vez, vale a mais recente.
export async function vinculosAprovados(guildId: string): Promise<Map<string, string>> {
  const { data, error } = await db().from("recrutamento_candidaturas")
    .select("discord_user_id, albion_player_id, decidido_em")
    .eq("guild_id", guildId).eq("status", "aprovada").not("albion_player_id", "is", null)
    .order("decidido_em", { ascending: true });
  if (error) throw new Error(`Erro ao ler candidaturas aprovadas: ${error.message}`);

  const porDiscord = new Map<string, string>();
  for (const l of (data ?? []) as Array<{ discord_user_id: string; albion_player_id: string }>) {
    porDiscord.set(l.discord_user_id, l.albion_player_id); // a última sobrescreve
  }
  const porJogador = new Map<string, string>();
  for (const [discord, jogador] of porDiscord) porJogador.set(jogador, discord);

  const { data: tabela, error: erroTabela } = await db().from("membros_vinculo")
    .select("albion_player_id, discord_user_id").eq("guild_id", guildId);
  if (erroTabela) throw new Error(`Erro ao ler membros_vinculo: ${erroTabela.message}`);
  for (const l of (tabela ?? []) as Array<{ albion_player_id: string; discord_user_id: string }>) {
    porJogador.set(l.albion_player_id, l.discord_user_id);
  }
  return porJogador;
}

export async function eventosJaPostados(guildId: string, ids: number[]): Promise<Set<number>> {
  if (ids.length === 0) return new Set();
  const { data, error } = await db().from("killboard_postados").select("event_id")
    .eq("guild_id", guildId).in("event_id", ids);
  if (error) throw new Error(`Erro ao ler killboard_postados: ${error.message}`);
  return new Set(((data ?? []) as Array<{ event_id: number }>).map((l) => Number(l.event_id)));
}

export async function registrarPostado(
  guildId: string,
  eventId: number,
  tipo: TipoEvento,
  mensagemId: string | null,
  fama: number,
  discordIds: string[],
  nomes: string[],
): Promise<void> {
  const { error } = await db().from("killboard_postados").upsert(
    { guild_id: guildId, event_id: eventId, tipo, mensagem_id: mensagemId, fama, discord_ids: discordIds, nomes },
    { onConflict: "guild_id,event_id", ignoreDuplicates: true },
  );
  if (error) throw new Error(`Erro ao gravar killboard_postados: ${error.message}`);
}

// Eventos postados nos últimos `dias` (base do ranking).
export async function postadosRecentes(guildId: string, dias: number): Promise<LinhaRanking[]> {
  const desde = new Date(Date.now() - dias * 24 * 60 * 60 * 1000).toISOString();
  const { data, error } = await db().from("killboard_postados").select("tipo, fama, discord_ids, nomes")
    .eq("guild_id", guildId).gte("postado_em", desde);
  if (error) throw new Error(`Erro ao ler killboard_postados: ${error.message}`);
  return ((data ?? []) as Array<{ tipo: TipoEvento; fama: number; discord_ids: string[]; nomes: string[] }>)
    .map((l) => ({ tipo: l.tipo, fama: Number(l.fama), discordIds: l.discord_ids ?? [], nomes: l.nomes ?? [] }));
}

// Evento completo (equipamento etc.) para a imagem do card. Gravado ANTES de postar: o Discord busca
// a imagem assim que a mensagem chega.
export async function guardarEvento(evento: { EventId: number }): Promise<void> {
  const { error } = await db().from("killboard_eventos").upsert({ event_id: evento.EventId, evento });
  if (error) throw new Error(`Erro ao gravar killboard_eventos: ${error.message}`);
}
