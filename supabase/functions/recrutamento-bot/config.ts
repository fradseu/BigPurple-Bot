// config.ts - Configurações do bot de recrutamento (Big Purple).
// IDs de canal/cargo NÃO são secretos — ficam aqui, como no bot de conteúdo.
// (Pra copiar um ID: Discord > Configurações > Avançado > Modo desenvolvedor,
//  depois botão direito no canal/cargo > Copiar ID.)

// Servidor do Albion: Americas/West (inclui o Sul-Americano).
// Europa: https://gameinfo-ams.albiononline.com/api/gameinfo
// Ásia:   https://gameinfo-sgp.albiononline.com/api/gameinfo
export const ALBION_API_BASE = "https://gameinfo.albiononline.com/api/gameinfo";

export function urlKillboardJogador(id: string): string {
  return `https://albiononline.com/killboard/player/${id}`;
}

// Nome da guilda no jogo — usado pra avisar quando o candidato já está nela.
export const NOME_GUILDA = "Big Purple";

// Canal onde o dossiê é postado pros recrutadores (PREENCHER).
export const CANAL_RECRUTADORES_ID = "";

// Cargo @Recrutador: é marcado a cada candidatura nova e é o único (junto com
// quem tem "Gerenciar Servidor") que pode Aprovar/Recusar (PREENCHER).
export const CARGO_RECRUTADOR_ID = "";

// Sinais do dossiê
export const DIAS_INATIVIDADE = 30; // sem nenhum evento de PvP há mais que isso = aviso
export const TOLERANCIA_FAMA = 0.25; // fama declarada fora de ±25% do calculado = aviso
export const MIN_GUILDAS_PARA_AVISO = 3; // passou por 3+ guildas nos eventos recentes = aviso

export const TIMEOUT_API_ALBION_MS = 8000;

export const COR_PENDENTE = 0x7b2cbf; // roxo
export const COR_APROVADA = 0x2ecc71;
export const COR_RECUSADA = 0xe74c3c;
