// domain.ts - Regras puras do acompanhamento da guilda (sem rede, sem banco): transformam o
// que a API do Albion devolve nas linhas que gravamos e decidem quem entrou ou saiu.

export type Papel = "fundador" | "conselheiro" | "player";
export type OrigemEntrada = "dia_seguinte_a_fundacao" | "primeiro_dia_visto";

import { montarHistoricoGuildas, PassagemGuilda } from "../_shared/albion/historico.ts";

// Evento do killboard (kill ou morte) como a API devolve; só o que usamos.
export interface EventoKillboard {
  TimeStamp: string;
  TotalVictimKillFame?: number;
  Killer: { Name: string; GuildName?: string | null };
  Victim: { Name: string; GuildName?: string | null };
}

// Só o que usamos da resposta de /guilds/{id}/members. Todo campo pode faltar.
export interface MembroApi {
  Id: string;
  Name: string;
  AllianceName?: string | null;
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
  alianca: string | null;
  fama_total: number | null;
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

// A "fama total" do dossiê do recrutamento: PvE + coleta + craft + pesca + fazenda + PvP (kill
// fame). Mesma soma, pra o número daqui bater com o que o recrutador viu na candidatura.
export function famaTotalDe(m: MembroApi): number {
  const e = m.LifetimeStatistics;
  return (e?.PvE?.Total ?? 0) + (e?.Gathering?.All?.Total ?? 0) + (e?.Crafting?.Total ?? 0) +
    (e?.FishingFame ?? 0) + (e?.FarmingFame ?? 0) + (m.KillFame ?? 0);
}

export function montarLinhaSnapshot(guildId: string, dia: string, m: MembroApi): LinhaSnapshot {
  const e = m.LifetimeStatistics ?? {};
  const coleta = e.Gathering ?? {};
  return {
    albion_guild_id: guildId,
    player_id: m.Id,
    dia,
    nome: m.Name,
    alianca: m.AllianceName || null,
    fama_total: famaTotalDe(m),
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

export interface EventoResumo {
  quando: number; // epoch ms
  oponente: string;
  guildaOponente: string | null;
  fama: number;
}

export interface ResumoKillboard {
  killboard_ok: boolean;
  ultima_atividade_pvp: string | null;
  kills_recentes: number | null;
  mortes_recentes: number | null;
  eventos_pvp_no_dia: number | null;
  ultimas_kills: EventoResumo[] | null;
  ultimas_mortes: EventoResumo[] | null;
  guildas_vistas: PassagemGuilda[] | null;
}

function resumirEventos(eventos: EventoKillboard[], lado: "killer" | "victim"): EventoResumo[] {
  return eventos
    .map((e) => {
      const oponente = lado === "killer" ? e.Victim : e.Killer;
      return {
        quando: Date.parse(e.TimeStamp),
        oponente: oponente.Name,
        guildaOponente: oponente.GuildName || null,
        fama: e.TotalVictimKillFame ?? 0,
      };
    })
    .sort((a, b) => b.quando - a.quando);
}

// Tudo que o dossiê tira do killboard, mais "quantos eventos de PvP no dia" pro progresso diário.
// kills/mortes = null quando a chamada falhou: nada vira zero, `killboard_ok` fica false.
export function resumirKillboard(
  kills: EventoKillboard[] | null,
  mortes: EventoKillboard[] | null,
  dia: string,
): ResumoKillboard {
  if (kills === null || mortes === null) {
    return {
      killboard_ok: false,
      ultima_atividade_pvp: null,
      kills_recentes: null,
      mortes_recentes: null,
      eventos_pvp_no_dia: null,
      ultimas_kills: null,
      ultimas_mortes: null,
      guildas_vistas: null,
    };
  }

  // A guilda do jogador em cada evento: na kill ele é o Killer, na morte é a Victim.
  const doJogador = [
    ...kills.map((e) => ({ quando: Date.parse(e.TimeStamp), guilda: e.Killer.GuildName })),
    ...mortes.map((e) => ({ quando: Date.parse(e.TimeStamp), guilda: e.Victim.GuildName })),
  ];
  const ultima = doJogador.length > 0 ? Math.max(...doJogador.map((e) => e.quando)) : null;

  return {
    killboard_ok: true,
    ultima_atividade_pvp: ultima === null ? null : new Date(ultima).toISOString(),
    kills_recentes: kills.length,
    mortes_recentes: mortes.length,
    eventos_pvp_no_dia: doJogador.filter((e) => diaDeBrasilia(e.quando) === dia).length,
    ultimas_kills: resumirEventos(kills, "killer").slice(0, 3),
    ultimas_mortes: resumirEventos(mortes, "victim").slice(0, 3),
    guildas_vistas: montarHistoricoGuildas(doJogador),
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
