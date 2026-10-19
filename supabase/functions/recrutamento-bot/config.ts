// config.ts - Configurações do bot de recrutamento (Big Purple).
// Canal e cargo dos recrutadores NÃO ficam mais aqui: são configurados por
// servidor, no Discord, com /recrutamento-config (e guardados no Supabase).

// Servidor do Albion: Americas/West (inclui o Sul-Americano).
// Europa: https://gameinfo-ams.albiononline.com/api/gameinfo
// Ásia:   https://gameinfo-sgp.albiononline.com/api/gameinfo
export const ALBION_API_BASE = "https://gameinfo.albiononline.com/api/gameinfo";

export function urlKillboardJogador(id: string): string {
  return `https://albiononline.com/killboard/player/${id}`;
}

// Nome da guilda no jogo — usado pra avisar quando o candidato já está nela.
export const NOME_GUILDA = "Big Purple";

// Sinais do dossiê
export const DIAS_INATIVIDADE = 30; // sem nenhum evento de PvP há mais que isso = aviso
export const TOLERANCIA_FAMA = 0.25; // fama declarada fora de ±25% do calculado = aviso
export const MIN_GUILDAS_PARA_AVISO = 3; // passou por 3+ guildas nos eventos recentes = aviso

export const TIMEOUT_API_ALBION_MS = 8000;

export const COR_PENDENTE = 0x7b2cbf; // roxo
export const COR_APROVADA = 0x2ecc71;
export const COR_RECUSADA = 0xe74c3c;
