// historico.ts - Reconstrói por quais guildas o jogador "foi visto".
//
// A API oficial do Albion NÃO tem histórico de guildas. O que ela tem: cada
// evento do killboard (kill ou morte) registra a guilda que o jogador tinha
// NAQUELE momento. Juntando os eventos em ordem de tempo dá pra ver as
// passagens — só que só enxerga períodos em que ele teve PvP.

export interface EventoDoJogador {
  quando: number; // epoch em ms
  guilda: string | null | undefined;
}

export interface PassagemGuilda {
  guilda: string;
  primeiraVez: number;
  ultimaVez: number;
  eventos: number;
}

export const SEM_GUILDA = "(sem guilda)";

// Mais recente primeiro. Eventos seguidos na mesma guilda viram UMA passagem.
export function montarHistoricoGuildas(eventos: EventoDoJogador[]): PassagemGuilda[] {
  const ordenados = [...eventos].sort((a, b) => a.quando - b.quando);
  const passagens: PassagemGuilda[] = [];

  for (const evento of ordenados) {
    const guilda = evento.guilda?.trim() || SEM_GUILDA;
    const ultima = passagens[passagens.length - 1];
    if (ultima && ultima.guilda === guilda) {
      ultima.ultimaVez = evento.quando;
      ultima.eventos += 1;
    } else {
      passagens.push({ guilda, primeiraVez: evento.quando, ultimaVez: evento.quando, eventos: 1 });
    }
  }

  return passagens.reverse();
}
