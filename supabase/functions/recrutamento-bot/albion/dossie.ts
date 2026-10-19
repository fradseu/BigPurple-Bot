// dossie.ts - Junta tudo que a API do Albion sabe sobre um jogador num "dossiê":
// identidade, fama (total e por tipo), PvP recente, guildas pelas quais foi
// visto (via killboard) e alertas pro recrutador.
//
// Separado em duas partes de propósito:
//   - analisarDossie(): PURA (recebe os dados, devolve o dossiê) — testável
//   - gerarDossie():    faz as chamadas HTTP e entrega pra função pura
import {
  DIAS_INATIVIDADE,
  MIN_GUILDAS_PARA_AVISO,
  NOME_GUILDA,
  TOLERANCIA_FAMA,
} from "../config.ts";
import { formatarFama, lerFamaDeclarada } from "../domain/fama.ts";
import {
  EventoDoJogador,
  montarHistoricoGuildas,
  PassagemGuilda,
} from "../domain/historico.ts";
import {
  buscarJogadores,
  EventoKillboard,
  JogadorBusca,
  JogadorDetalhe,
  obterJogador,
  obterKills,
  obterMortes,
} from "./api.ts";

export interface EventoResumo {
  quando: number; // epoch ms
  oponente: string;
  guildaOponente: string | null;
  fama: number;
}

export interface DossieJogador {
  id: string;
  nome: string;
  guildaAtual: string | null;
  aliancaAtual: string | null;
  fama: {
    pve: number;
    coleta: number;
    craft: number;
    pesca: number;
    fazenda: number;
    pvp: number; // KillFame
    total: number; // soma de tudo
  };
  // Detalhamento da fama (tudo vem do LifetimeStatistics da API).
  detalhes: {
    pveZonas: Record<string, number>; // Royal, Outlands, Avalon, Mists, Corrompidas, Hellgate
    coletaTipos: Record<string, number>; // Fibra, Couro, Minério, Pedra, Madeira
    coletaZonas: Record<string, number>; // Royal, Outlands, Avalon
  };
  deathFame: number;
  razaoFama: number;
  totalKills: number; // quantos eventos de kill a API devolveu (janela recente)
  totalMortes: number;
  ultimaAtividade: number | null; // epoch ms do evento de PvP mais recente
  guildasVistas: PassagemGuilda[];
  ultimasKills: EventoResumo[];
  ultimasMortes: EventoResumo[];
  snapshotEm: string | null; // quando a API atualizou as estatísticas
}

export type StatusDossie = "ok" | "nao_encontrado" | "api_indisponivel";

export interface Dossie {
  status: StatusDossie;
  geradoEm: number; // epoch ms
  jogador: DossieJogador | null;
  similares: string[]; // nicks parecidos, quando o exato não existe
  famaDeclarada: number | null;
  diferencaFamaPct: number | null; // (declarada - calculada) / calculada
  alertas: string[];
  erro?: string;
}

const DIA_MS = 24 * 60 * 60 * 1000;

function resumirEventos(
  eventos: EventoKillboard[],
  lado: "killer" | "victim",
): EventoResumo[] {
  return eventos
    .map((e) => {
      const oponente = lado === "killer" ? e.Victim : e.Killer;
      return {
        quando: Date.parse(e.TimeStamp),
        oponente: oponente.Name,
        guildaOponente: oponente.GuildName || null,
        fama: e.TotalVictimKillFame,
      };
    })
    .sort((a, b) => b.quando - a.quando);
}

// kills/mortes = null quando o killboard falhou (diferente de [] = "não teve nenhum").
export function analisarDossie(params: {
  jogador: JogadorDetalhe;
  kills: EventoKillboard[] | null;
  mortes: EventoKillboard[] | null;
  famaDeclaradaTexto: string;
  agora: number;
}): Dossie {
  const { jogador, famaDeclaradaTexto, agora } = params;
  const killboardIndisponivel = params.kills === null || params.mortes === null;
  const kills = params.kills ?? [];
  const mortes = params.mortes ?? [];
  const ls = jogador.LifetimeStatistics;

  const fama = {
    pve: ls?.PvE?.Total ?? 0,
    coleta: ls?.Gathering?.All?.Total ?? 0,
    craft: ls?.Crafting?.Total ?? 0,
    pesca: ls?.FishingFame ?? 0,
    fazenda: ls?.FarmingFame ?? 0,
    pvp: jogador.KillFame ?? 0,
    total: 0,
  };
  fama.total = fama.pve + fama.coleta + fama.craft + fama.pesca + fama.fazenda + fama.pvp;

  // A guilda do jogador em cada evento: na kill ele é o Killer, na morte é a Victim.
  const eventosDoJogador: EventoDoJogador[] = [
    ...kills.map((e) => ({ quando: Date.parse(e.TimeStamp), guilda: e.Killer.GuildName })),
    ...mortes.map((e) => ({ quando: Date.parse(e.TimeStamp), guilda: e.Victim.GuildName })),
  ];
  const guildasVistas = montarHistoricoGuildas(eventosDoJogador);

  const ultimasKills = resumirEventos(kills, "killer");
  const ultimasMortes = resumirEventos(mortes, "victim");
  const ultimaAtividade = eventosDoJogador.length > 0
    ? Math.max(...eventosDoJogador.map((e) => e.quando))
    : null;

  const famaDeclarada = lerFamaDeclarada(famaDeclaradaTexto);
  const diferencaFamaPct = famaDeclarada !== null && fama.total > 0
    ? (famaDeclarada - fama.total) / fama.total
    : null;

  const guildaAtual = jogador.GuildName || null;
  const alertas: string[] = [];

  if (famaDeclarada === null) {
    alertas.push(`Não consegui entender a fama declarada ("${famaDeclaradaTexto}").`);
  } else if (diferencaFamaPct !== null && Math.abs(diferencaFamaPct) > TOLERANCIA_FAMA) {
    const sinal = diferencaFamaPct > 0 ? "acima" : "abaixo";
    alertas.push(
      `Fama declarada (${formatarFama(famaDeclarada)}) está ${
        Math.round(Math.abs(diferencaFamaPct) * 100)
      }% ${sinal} da calculada pela API (${formatarFama(fama.total)}).`,
    );
  }

  if (guildaAtual && guildaAtual.toLowerCase() !== NOME_GUILDA.toLowerCase()) {
    alertas.push(`Já está em outra guilda: **${guildaAtual}**.`);
  }
  if (guildaAtual && guildaAtual.toLowerCase() === NOME_GUILDA.toLowerCase()) {
    alertas.push(`Já consta como membro da **${NOME_GUILDA}** no jogo.`);
  }

  const guildasReais = guildasVistas.filter((g) => g.guilda !== "(sem guilda)");
  if (guildasReais.length >= MIN_GUILDAS_PARA_AVISO) {
    alertas.push(`Passou por ${guildasReais.length} guildas nos eventos recentes.`);
  }

  if (killboardIndisponivel) {
    alertas.push("Killboard indisponível agora — PvP e guildas vistas estão incompletos (use 🔄).");
  } else if (ultimaAtividade === null) {
    alertas.push("Nenhum evento de PvP no killboard (pouco ou nenhum PvP).");
  } else if (agora - ultimaAtividade > DIAS_INATIVIDADE * DIA_MS) {
    alertas.push(`Sem PvP há mais de ${DIAS_INATIVIDADE} dias.`);
  }

  return {
    status: "ok",
    geradoEm: agora,
    jogador: {
      id: jogador.Id,
      nome: jogador.Name,
      guildaAtual,
      aliancaAtual: jogador.AllianceName || null,
      fama,
      detalhes: {
        pveZonas: {
          Royal: ls?.PvE?.Royal ?? 0,
          Outlands: ls?.PvE?.Outlands ?? 0,
          Avalon: ls?.PvE?.Avalon ?? 0,
          Mists: ls?.PvE?.Mists ?? 0,
          Corrompidas: ls?.PvE?.CorruptedDungeon ?? 0,
          Hellgate: ls?.PvE?.Hellgate ?? 0,
        },
        coletaTipos: {
          Fibra: ls?.Gathering?.Fiber?.Total ?? 0,
          Couro: ls?.Gathering?.Hide?.Total ?? 0,
          Minério: ls?.Gathering?.Ore?.Total ?? 0,
          Pedra: ls?.Gathering?.Rock?.Total ?? 0,
          Madeira: ls?.Gathering?.Wood?.Total ?? 0,
        },
        coletaZonas: {
          Royal: ls?.Gathering?.All?.Royal ?? 0,
          Outlands: ls?.Gathering?.All?.Outlands ?? 0,
          Avalon: ls?.Gathering?.All?.Avalon ?? 0,
        },
      },
      deathFame: jogador.DeathFame ?? 0,
      razaoFama: jogador.FameRatio ?? 0,
      totalKills: kills.length,
      totalMortes: mortes.length,
      ultimaAtividade,
      guildasVistas,
      ultimasKills: ultimasKills.slice(0, 3),
      ultimasMortes: ultimasMortes.slice(0, 3),
      snapshotEm: ls?.Timestamp ?? null,
    },
    similares: [],
    famaDeclarada,
    diferencaFamaPct,
    alertas,
  };
}

function dossieSemJogador(
  status: StatusDossie,
  famaDeclaradaTexto: string,
  agora: number,
  extras: Partial<Dossie> = {},
): Dossie {
  return {
    status,
    geradoEm: agora,
    jogador: null,
    similares: [],
    famaDeclarada: lerFamaDeclarada(famaDeclaradaTexto),
    diferencaFamaPct: null,
    alertas: [],
    ...extras,
  };
}

// Procura o nick (igualdade exata, sem diferenciar maiúsculas) e monta o dossiê.
// NUNCA lança: se a API estiver fora, devolve status "api_indisponivel" — a
// candidatura continua sendo enviada pros recrutadores, só sem o dossiê.
export async function gerarDossie(nick: string, famaDeclaradaTexto: string): Promise<Dossie> {
  const agora = Date.now();

  let encontrados: JogadorBusca[];
  try {
    encontrados = await buscarJogadores(nick);
  } catch (err) {
    return dossieSemJogador("api_indisponivel", famaDeclaradaTexto, agora, {
      erro: err instanceof Error ? err.message : String(err),
    });
  }

  const exato = encontrados.find((p) => p.Name.toLowerCase() === nick.trim().toLowerCase());
  if (!exato) {
    return dossieSemJogador("nao_encontrado", famaDeclaradaTexto, agora, {
      similares: encontrados.slice(0, 5).map((p) => p.Name),
      alertas: ["Nick não encontrado no Albion (confira a grafia)."],
    });
  }

  try {
    const [detalhe, kills, mortes] = await Promise.all([
      obterJogador(exato.Id),
      // Kills/mortes são "bônus": se falharem, o dossiê sai sem elas em vez de falhar tudo.
      obterKills(exato.Id).catch(() => null),
      obterMortes(exato.Id).catch(() => null),
    ]);
    return analisarDossie({ jogador: detalhe, kills, mortes, famaDeclaradaTexto, agora });
  } catch (err) {
    return dossieSemJogador("api_indisponivel", famaDeclaradaTexto, agora, {
      erro: err instanceof Error ? err.message : String(err),
    });
  }
}
