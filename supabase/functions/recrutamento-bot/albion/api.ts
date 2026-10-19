// api.ts - Cliente da API pública do Albion Online (gameinfo). Sem chave, sem login.
import { ALBION_API_BASE, TIMEOUT_API_ALBION_MS } from "../config.ts";

export interface JogadorBusca {
  Id: string;
  Name: string;
  GuildName: string | null;
  AllianceName: string | null;
  KillFame: number;
  DeathFame: number;
}

export interface JogadorDetalhe {
  Id: string;
  Name: string;
  GuildName: string | null;
  AllianceName: string | null;
  KillFame: number;
  DeathFame: number;
  FameRatio: number;
  LifetimeStatistics?: {
    PvE?: {
      Total?: number;
      Royal?: number;
      Outlands?: number;
      Avalon?: number;
      Hellgate?: number;
      CorruptedDungeon?: number;
      Mists?: number;
    };
    Gathering?: {
      Fiber?: FamaColeta;
      Hide?: FamaColeta;
      Ore?: FamaColeta;
      Rock?: FamaColeta;
      Wood?: FamaColeta;
      All?: FamaColeta;
    };
    Crafting?: { Total?: number };
    CrystalLeague?: number;
    FishingFame?: number;
    FarmingFame?: number;
    Timestamp?: string;
  };
}

export interface FamaColeta {
  Total?: number;
  Royal?: number;
  Outlands?: number;
  Avalon?: number;
}

export interface ParticipanteEvento {
  Name: string;
  GuildName: string | null;
  AllianceName: string | null;
}

export interface EventoKillboard {
  EventId: number;
  TimeStamp: string;
  TotalVictimKillFame: number;
  Killer: ParticipanteEvento;
  Victim: ParticipanteEvento;
}

async function pegarJson<T>(caminho: string): Promise<T> {
  let ultimoErro: unknown;
  // 2 tentativas: a API do Albion oscila (timeouts/5xx) com frequência.
  for (let tentativa = 1; tentativa <= 2; tentativa++) {
    try {
      const res = await fetch(`${ALBION_API_BASE}${caminho}`, {
        signal: AbortSignal.timeout(TIMEOUT_API_ALBION_MS),
      });
      if (!res.ok) throw new Error(`Albion API ${caminho} -> ${res.status}`);
      return await res.json() as T;
    } catch (err) {
      ultimoErro = err;
    }
  }
  throw ultimoErro instanceof Error ? ultimoErro : new Error(String(ultimoErro));
}

export async function buscarJogadores(nome: string): Promise<JogadorBusca[]> {
  const res = await pegarJson<{ players?: JogadorBusca[] }>(
    `/search?q=${encodeURIComponent(nome)}`,
  );
  return res.players ?? [];
}

export function obterJogador(id: string): Promise<JogadorDetalhe> {
  return pegarJson<JogadorDetalhe>(`/players/${encodeURIComponent(id)}`);
}

export function obterKills(id: string): Promise<EventoKillboard[]> {
  return pegarJson<EventoKillboard[]>(`/players/${encodeURIComponent(id)}/kills`);
}

export function obterMortes(id: string): Promise<EventoKillboard[]> {
  return pegarJson<EventoKillboard[]>(`/players/${encodeURIComponent(id)}/deaths`);
}
