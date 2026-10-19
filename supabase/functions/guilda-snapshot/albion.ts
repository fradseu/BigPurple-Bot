// albion.ts - Cliente da API oficial do Albion (gameinfo, servidor das Américas). A API é lenta
// e às vezes não responde, então cada chamada tem tempo limite e algumas tentativas.
import { EventoKillboard, MembroApi } from "./domain.ts";

const BASE = "https://gameinfo.albiononline.com/api/gameinfo";
const TEMPO_LIMITE_MS = 45_000;
const TENTATIVAS = 3;

export interface GuildaApi {
  Id: string;
  Name: string;
  FounderId: string;
  FounderName: string;
  Founded: string;
  killFame?: number;
  DeathFame?: number;
  AttacksWon?: number | null;
  DefensesWon?: number | null;
  MemberCount?: number;
}

async function buscarJson<T>(caminho: string): Promise<T> {
  let ultimoErro: unknown;
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const res = await fetch(`${BASE}${caminho}`, {
        headers: { "user-agent": "BigPurple-Bot/1.0" },
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json() as T;
    } catch (err) {
      ultimoErro = err;
      if (tentativa < TENTATIVAS) await new Promise((r) => setTimeout(r, 2_000 * tentativa));
    }
  }
  throw new Error(`Albion ${caminho} falhou depois de ${TENTATIVAS} tentativas: ${ultimoErro}`);
}

export const buscarGuilda = (id: string) => buscarJson<GuildaApi>(`/guilds/${id}`);
export const buscarMembros = (id: string) => buscarJson<MembroApi[]>(`/guilds/${id}/members`);

// Killboard do jogador (mesmo que o dossiê usa): kills e mortes recentes.
export const buscarKills = (playerId: string) =>
  buscarJson<EventoKillboard[]>(`/players/${encodeURIComponent(playerId)}/kills`);
export const buscarMortes = (playerId: string) =>
  buscarJson<EventoKillboard[]>(`/players/${encodeURIComponent(playerId)}/deaths`);
