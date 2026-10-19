// domain.ts - Regras puras do acompanhamento da guilda (sem rede, sem banco): transformam o
// que a API do Albion devolve nas linhas que gravamos e decidem quem entrou ou saiu.

export type Papel = "fundador" | "conselheiro" | "player";
export type OrigemEntrada = "dia_seguinte_a_fundacao" | "primeiro_dia_visto";

// Só o que usamos da resposta de /guilds/{id}/members. Todo campo pode faltar.
export interface MembroApi {
  Id: string;
  Name: string;
  KillFame?: number;
  DeathFame?: number;
  FameRatio?: number;
  LifetimeStatistics?: {
    PvE?: Record<string, number>;
    Gathering?: Record<string, Record<string, number>>;
    Crafting?: Record<string, number>;
    CrystalLeague?: number;
    FishingFame?: number;
    FarmingFame?: number;
    Timestamp?: string;
  } | null;
}

export interface LinhaSnapshot {
  albion_guild_id: string;
  player_id: string;
  dia: string;
  nome: string;
  kill_fame: number | null;
  death_fame: number | null;
  fame_ratio: number | null;
  pve_total: number | null;
  pve_royal: number | null;
  pve_outlands: number | null;
  pve_avalon: number | null;
  pve_hellgate: number | null;
  pve_corrupted: number | null;
  pve_mists: number | null;
  coleta_total: number | null;
  coleta_royal: number | null;
  coleta_outlands: number | null;
  coleta_avalon: number | null;
  coleta_fibra: number | null;
  coleta_couro: number | null;
  coleta_minerio: number | null;
  coleta_pedra: number | null;
  coleta_madeira: number | null;
  craft_total: number | null;
  craft_royal: number | null;
  craft_outlands: number | null;
  craft_avalon: number | null;
  pesca: number | null;
  fazenda: number | null;
  crystal: number | null;
  estatisticas_em: string | null;
  bruto: unknown;
}

// Número ou null. Campo ausente NÃO vira zero: "não veio" é diferente de "é zero".
function numero(valor: unknown): number | null {
  return typeof valor === "number" && Number.isFinite(valor) ? Math.trunc(valor) : null;
}

export function montarLinhaSnapshot(guildId: string, dia: string, m: MembroApi): LinhaSnapshot {
  const e = m.LifetimeStatistics ?? {};
  const coleta = e.Gathering ?? {};
  return {
    albion_guild_id: guildId,
    player_id: m.Id,
    dia,
    nome: m.Name,
    kill_fame: numero(m.KillFame),
    death_fame: numero(m.DeathFame),
    fame_ratio: typeof m.FameRatio === "number" ? m.FameRatio : null,
    pve_total: numero(e.PvE?.Total),
    pve_royal: numero(e.PvE?.Royal),
    pve_outlands: numero(e.PvE?.Outlands),
    pve_avalon: numero(e.PvE?.Avalon),
    pve_hellgate: numero(e.PvE?.Hellgate),
    pve_corrupted: numero(e.PvE?.CorruptedDungeon),
    pve_mists: numero(e.PvE?.Mists),
    coleta_total: numero(coleta.All?.Total),
    coleta_royal: numero(coleta.All?.Royal),
    coleta_outlands: numero(coleta.All?.Outlands),
    coleta_avalon: numero(coleta.All?.Avalon),
    coleta_fibra: numero(coleta.Fiber?.Total),
    coleta_couro: numero(coleta.Hide?.Total),
    coleta_minerio: numero(coleta.Ore?.Total),
    coleta_pedra: numero(coleta.Rock?.Total),
    coleta_madeira: numero(coleta.Wood?.Total),
    craft_total: numero(e.Crafting?.Total),
    craft_royal: numero(e.Crafting?.Royal),
    craft_outlands: numero(e.Crafting?.Outlands),
    craft_avalon: numero(e.Crafting?.Avalon),
    pesca: numero(e.FishingFame),
    fazenda: numero(e.FarmingFame),
    crystal: numero(e.CrystalLeague),
    estatisticas_em: e.Timestamp ?? null,
    bruto: m,
  };
}

// O dia do retrato no horário de Brasília (UTC-3), pra "dia" bater com o dia da guilda.
export function diaDeBrasilia(agoraMs: number): string {
  return new Date(agoraMs - 3 * 3_600_000).toISOString().slice(0, 10);
}

// A API não diz quando alguém entrou. Se é a PRIMEIRA vez que olhamos esta guilda, todo mundo
// "entrou no dia seguinte à fundação"; depois disso, quem aparece de novo entrou no dia em que
// vimos pela primeira vez.
export function dataDeEntrada(
  primeiraExecucao: boolean,
  fundadaEmIso: string,
  dia: string,
): { data: string; origem: OrigemEntrada } {
  if (!primeiraExecucao) return { data: dia, origem: "primeiro_dia_visto" };
  const seguinte = new Date(Date.parse(fundadaEmIso.slice(0, 10) + "T00:00:00Z") + 86_400_000);
  return { data: seguinte.toISOString().slice(0, 10), origem: "dia_seguinte_a_fundacao" };
}

export function papelDe(
  playerId: string,
  nome: string,
  fundadorId: string,
  conselheirosNomes: string[],
): Papel {
  if (playerId === fundadorId) return "fundador";
  const alvo = nome.toLowerCase();
  return conselheirosNomes.some((n) => n.toLowerCase() === alvo) ? "conselheiro" : "player";
}

export interface MembroRegistrado {
  player_id: string;
  nome: string;
  ativo: boolean;
}

export interface MudancasDeMembros {
  novos: MembroApi[]; // nunca vistos
  voltaram: string[]; // estavam marcados como saídos e reapareceram
  saiu: string[]; // ativos que não vieram mais na lista
}

export function compararMembros(registrados: MembroRegistrado[], atuais: MembroApi[]): MudancasDeMembros {
  const conhecidos = new Map(registrados.map((r) => [r.player_id, r]));
  const idsAtuais = new Set(atuais.map((a) => a.Id));
  return {
    novos: atuais.filter((a) => !conhecidos.has(a.Id)),
    voltaram: atuais.filter((a) => conhecidos.get(a.Id)?.ativo === false).map((a) => a.Id),
    saiu: registrados.filter((r) => r.ativo && !idsAtuais.has(r.player_id)).map((r) => r.player_id),
  };
}
