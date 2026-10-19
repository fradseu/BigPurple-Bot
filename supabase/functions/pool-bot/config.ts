// config.ts - Configurações do Pool de conteúdo.
// As listas de atividade e classe são as MESMAS do bot de conteúdo (nomes iguais),
// pra um disponível do pool casar com as vagas de uma PT na fase 2.

export interface Opcao {
  label: string;
  value: string;
}

export const ATIVIDADES: Opcao[] = [
  { label: "DG Grupo", value: "DG Grupo" },
  { label: "DG Fixa", value: "DG Fixa" },
  { label: "Caçada em Grupo", value: "Caçada" },
  { label: "Guerra de Facção", value: "Guerra de Facção" },
  { label: "Roaming / Gank", value: "Roaming/Gank" },
  { label: "Coleta na Black", value: "Coleta na Black" },
  { label: "Coleta na Avalon", value: "Coleta na Avalon" },
  { label: "Baú Azul", value: "Baús Azul" },
  { label: "Baú Dourado", value: "Baús Dourado" },
  { label: "Apagas", value: "Apagas" },
  { label: "Spec de arma", value: "Spec de arma" },
  { label: "Transporte para Caerleon", value: "Transporte para Caerleon" },
  { label: "Aliança Avalon", value: "Aliança Avalon" },
  { label: "Aliança DG", value: "Aliança DG" },
  { label: "Aliança Guerra de Facção", value: "Aliança Guerra de Facção" },
  { label: "Aliança Zerg versus Zerg", value: "Aliança Zerg versus Zerg" },
];

// Áreas = os canais de ping onde as PTs são criadas (ping-pve, ping-pvp, ping-facção,
// ping-avalon). A pessoa escolhe em quais áreas quer jogar e, em seguida, as
// atividades (as do criador de conteúdo) daquelas áreas.
export interface Area {
  value: string;
  label: string;
  emoji: string;
}

export const AREAS: Area[] = [
  { value: "PVE", label: "PVE", emoji: "🔵" },
  { value: "PVP", label: "PVP", emoji: "🔴" },
  { value: "FAC", label: "Facção", emoji: "🟣" },
  { value: "AVALON", label: "Avalon", emoji: "🌌" },
];

// Quais atividades aparecem em cada área. Uma atividade pode estar em mais de uma
// área (ex: Coleta na Black serve pra quem quer PVE e pra quem quer PVP).
// AJUSTÁVEL: é só editar esta tabela — os valores são os de ATIVIDADES acima.
export const ATIVIDADES_POR_AREA: Record<string, string[]> = {
  PVE: ["DG Grupo", "DG Fixa", "Caçada", "Baús Azul", "Baús Dourado", "Apagas", "Spec de arma", "Coleta na Black", "Aliança DG", "Transporte para Caerleon"],
  PVP: ["Roaming/Gank", "Aliança Zerg versus Zerg", "Coleta na Black", "Transporte para Caerleon"],
  FAC: ["Guerra de Facção", "Aliança Guerra de Facção"],
  AVALON: ["Coleta na Avalon", "Aliança Avalon", "Aliança DG"],
};

// Atividades que fazem sentido pras áreas escolhidas (sem repetir, na ordem de
// ATIVIDADES). Sem nenhuma área escolhida ainda, mostra todas (pode escolher em qualquer ordem).
export function atividadesDasAreas(areas: string[]): Opcao[] {
  if (areas.length === 0) return ATIVIDADES;
  const permitidas = new Set(areas.flatMap((a) => ATIVIDADES_POR_AREA[a] ?? []));
  return ATIVIDADES.filter((a) => permitidas.has(a.value));
}

// Mesmos nomes das classes do bot de conteúdo (sem a tag de emoji).
export const CLASSES: string[] = [
  "BADÔNICO",
  "CHAMA SOMBRA",
  "FULGURANTE",
  "FURA-BRUMA",
  "MAIN HEALER",
  "TANK",
  "DPS",
  "OFF TANK",
  "SCOUT",
  "STOPPER CALL",
  "SUPORTE",
  "TRANSPORTE",
  "QUEBRA REINOS",
  "ADAGA DE UMA MÃO",
  "BESTA LEVE",
  "CAÇA-ESPIRÍTOS",
  "CORTA CURA",
  "ENIGMÁTICO",
  "LANÇA VIROTES",
  "MONGE NEGRO",
  "NATUREZA",
  "PRISMA",
  "PT HEALER",
];

export const TIERS: string[] = ["T4", "T5", "T6", "T7", "T8"];

// Quanto tempo a pessoa fica visível no catálogo (minutos).
export const DURACOES_MIN: Array<{ label: string; minutos: number }> = [
  { label: "1 hora", minutos: 60 },
  { label: "2 horas", minutos: 120 },
  { label: "4 horas", minutos: 240 },
  { label: "8 horas", minutos: 480 },
];

// Limites de escolha no formulário (o Discord aceita até 25 opções por lista).
export const MAX_AREAS = AREAS.length;
export const MAX_ATIVIDADES = 5;
export const MAX_CLASSES = 3;

export const COR_ROXO = 0x7b2cbf;
export const COR_VERDE = 0x2ecc71;
export const COR_CINZA = 0x95a5a6;
