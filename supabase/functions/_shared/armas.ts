// armas.ts - Catálogo COMPLETO das armas do Albion por árvore (17 árvores, 137 armas), com os
// nomes oficiais em português. Gerado a partir dos dados públicos do jogo (ao-data/ao-bin-dumps:
// items.json → shopsubcategory1 + formatted/items.json → LocalizedNames PT-BR), sem o sufixo de tier
// ("do Adepto"). `item` é o código base (sem tier) — serve pro ícone: render.albiononline.com.
//
// Usado pelo bot de conteúdo (vagas da PT) e pelo Pool (disponibilidade por árvore). Uma vaga é:
//   • uma FUNÇÃO genérica (HEALER, TANK, OFF TANK, SUPORTE, DPS);
//   • uma ÁRVORE genérica ("NATUREZA (QUALQUER)": qualquer arma daquela árvore);
//   • uma ARMA ("CAJADO DRUÍDICO", da árvore Natureza).
// No texto da vaga a classe vai como ":tag: NOME" (a tag vira o emoji; veja discord-bot/domain/emoji.ts).

export interface Arma {
  nome: string;
  item: string;
}

export interface Arvore {
  chave: string; // também é a tag do emoji (":natureza:")
  nome: string;
  emoji: string;
  armas: Arma[];
}

export const ARVORES: Arvore[] = [
  {
    chave: "arco",
    nome: "Arco",
    emoji: "🏹",
    armas: [
      { nome: "Arco", item: "2H_BOW" },
      { nome: "Arco de Guerra", item: "2H_WARBOW" },
      { nome: "Arco Longo", item: "2H_LONGBOW" },
      { nome: "Arco Sussurrante", item: "2H_LONGBOW_UNDEAD" },
      { nome: "Arco Plangente", item: "2H_BOW_HELL" },
      { nome: "Arco Badônico", item: "2H_BOW_KEEPER" },
      { nome: "Fura-bruma", item: "2H_BOW_AVALON" },
      { nome: "Arco do Andarilho Celeste", item: "2H_BOW_CRYSTAL" },
    ],
  },
  {
    chave: "besta",
    nome: "Besta",
    emoji: "🎯",
    armas: [
      { nome: "Besta", item: "2H_CROSSBOW" },
      { nome: "Besta Pesada", item: "2H_CROSSBOWLARGE" },
      { nome: "Besta Leve", item: "MAIN_1HCROSSBOW" },
      { nome: "Repetidor Lamentoso", item: "2H_REPEATINGCROSSBOW_UNDEAD" },
      { nome: "Lança-virotes", item: "2H_DUALCROSSBOW_HELL" },
      { nome: "Arco de Cerco", item: "2H_CROSSBOWLARGE_MORGANA" },
      { nome: "Modelador de Energia", item: "2H_CROSSBOW_CANNON_AVALON" },
      { nome: "Detonadores Reluzentes", item: "2H_DUALCROSSBOW_CRYSTAL" },
    ],
  },
  {
    chave: "espada",
    nome: "Espada",
    emoji: "🗡️",
    armas: [
      { nome: "Espada Larga", item: "MAIN_SWORD" },
      { nome: "Montante", item: "2H_CLAYMORE" },
      { nome: "Espadas Duplas", item: "2H_DUALSWORD" },
      { nome: "Lâmina Aclarada", item: "MAIN_SCIMITAR_MORGANA" },
      { nome: "Espada Entalhada", item: "2H_CLEAVER_HELL" },
      { nome: "Par de Galatinas", item: "2H_DUALSCIMITAR_UNDEAD" },
      { nome: "Cria-reis", item: "2H_CLAYMORE_AVALON" },
      { nome: "Lâmina da Infinidade", item: "MAIN_SWORD_CRYSTAL" },
    ],
  },
  {
    chave: "machado",
    nome: "Machado",
    emoji: "🪓",
    armas: [
      { nome: "Machado de Guerra", item: "MAIN_AXE" },
      { nome: "Machadão", item: "2H_AXE" },
      { nome: "Alabarda", item: "2H_HALBERD" },
      { nome: "Chama-corpos", item: "2H_HALBERD_MORGANA" },
      { nome: "Segadeira Infernal", item: "2H_SCYTHE_HELL" },
      { nome: "Patas de Urso", item: "2H_DUALAXE_KEEPER" },
      { nome: "Quebra-reino", item: "2H_AXE_AVALON" },
      { nome: "Foice de Cristal", item: "2H_SCYTHE_CRYSTAL" },
    ],
  },
  {
    chave: "maca",
    nome: "Maça",
    emoji: "⚒️",
    armas: [
      { nome: "Maça", item: "MAIN_MACE" },
      { nome: "Maça Pesada", item: "2H_MACE" },
      { nome: "Mangual", item: "2H_FLAIL" },
      { nome: "Maça Pétrea", item: "MAIN_ROCKMACE_KEEPER" },
      { nome: "Maça de Íncubo", item: "MAIN_MACE_HELL" },
      { nome: "Maça Cambriana", item: "2H_MACE_MORGANA" },
      { nome: "Jurador", item: "2H_DUALMACE_AVALON" },
      { nome: "Monarca Tempestuoso", item: "MAIN_MACE_CRYSTAL" },
    ],
  },
  {
    chave: "martelo",
    nome: "Martelo",
    emoji: "🔨",
    armas: [
      { nome: "Martelo", item: "MAIN_HAMMER" },
      { nome: "Martelo de Batalha", item: "2H_POLEHAMMER" },
      { nome: "Martelo Elevado", item: "2H_HAMMER" },
      { nome: "Martelo Fúnebre", item: "2H_HAMMER_UNDEAD" },
      { nome: "Martelos de Forja", item: "2H_DUALHAMMER_HELL" },
      { nome: "Guarda-bosques", item: "2H_RAM_KEEPER" },
      { nome: "Mão da Justiça", item: "2H_HAMMER_AVALON" },
      { nome: "Martelo Estrondoso", item: "2H_HAMMER_CRYSTAL" },
    ],
  },
  {
    chave: "manoplas",
    nome: "Manoplas",
    emoji: "🥊",
    armas: [
      { nome: "Mãos Pretas", item: "2H_IRONGAUNTLETS_HELL" },
      { nome: "Luvas de Lutador", item: "2H_KNUCKLES_SET1" },
      { nome: "Braçadeiras de Batalha", item: "2H_KNUCKLES_SET2" },
      { nome: "Manoplas Cravadas", item: "2H_KNUCKLES_SET3" },
      { nome: "Luvas Ursinas", item: "2H_KNUCKLES_KEEPER" },
      { nome: "Mãos Infernais", item: "2H_KNUCKLES_HELL" },
      { nome: "Cestus Golpeadores", item: "2H_KNUCKLES_MORGANA" },
      { nome: "Punhos de Avalon", item: "2H_KNUCKLES_AVALON" },
      { nome: "Braçadeiras Pulsantes", item: "2H_KNUCKLES_CRYSTAL" },
    ],
  },
  {
    chave: "lanca",
    nome: "Lança",
    emoji: "🔱",
    armas: [
      { nome: "Lança", item: "MAIN_SPEAR" },
      { nome: "Pique", item: "2H_SPEAR" },
      { nome: "Archa", item: "2H_GLAIVE" },
      { nome: "Lança Garceira", item: "MAIN_SPEAR_KEEPER" },
      { nome: "Caça-espíritos", item: "2H_HARPOON_HELL" },
      { nome: "Lança Trina", item: "2H_TRIDENT_UNDEAD" },
      { nome: "Alvorada", item: "MAIN_SPEAR_LANCE_AVALON" },
      { nome: "Archa Fraturada", item: "2H_GLAIVE_CRYSTAL" },
    ],
  },
  {
    chave: "adaga",
    nome: "Adaga",
    emoji: "🔪",
    armas: [
      { nome: "Adaga", item: "MAIN_DAGGER" },
      { nome: "Par de Adagas", item: "2H_DAGGERPAIR" },
      { nome: "Garras", item: "2H_CLAWPAIR" },
      { nome: "Dessangrador", item: "MAIN_RAPIER_MORGANA" },
      { nome: "Presa Demoníaca", item: "MAIN_DAGGER_HELL" },
      { nome: "Mortíficos", item: "2H_DUALSICKLE_UNDEAD" },
      { nome: "Fúria Contida", item: "2H_DAGGER_KATAR_AVALON" },
      { nome: "Gêmeas Aniquiladoras", item: "2H_DAGGERPAIR_CRYSTAL" },
    ],
  },
  {
    chave: "bordao",
    nome: "Bordão",
    emoji: "🥢",
    armas: [
      { nome: "Bordão", item: "2H_QUARTERSTAFF" },
      { nome: "Cajado Férreo", item: "2H_IRONCLADEDSTAFF" },
      { nome: "Cajado Bilaminado", item: "2H_DOUBLEBLADEDSTAFF" },
      { nome: "Cajado de Monge Negro", item: "2H_COMBATSTAFF_MORGANA" },
      { nome: "Seganímica", item: "2H_TWINSCYTHE_HELL" },
      { nome: "Cajado do Equilíbrio", item: "2H_ROCKSTAFF_KEEPER" },
      { nome: "Buscador do Graal", item: "2H_QUARTERSTAFF_AVALON" },
      { nome: "Lâminas Gêmeas Fantasmagóricas", item: "2H_DOUBLEBLADEDSTAFF_CRYSTAL" },
    ],
  },
  {
    chave: "fogo",
    nome: "Fogo",
    emoji: "🔥",
    armas: [
      { nome: "Cajado de Fogo", item: "MAIN_FIRESTAFF" },
      { nome: "Cajado de Fogo Elevado", item: "2H_FIRESTAFF" },
      { nome: "Cajado Infernal", item: "2H_INFERNOSTAFF" },
      { nome: "Cajado Incendiário", item: "MAIN_FIRESTAFF_KEEPER" },
      { nome: "Cajado Sulfuroso", item: "2H_FIRESTAFF_HELL" },
      { nome: "Cajado Fulgurante", item: "2H_INFERNOSTAFF_MORGANA" },
      { nome: "Canção da Alvorada", item: "2H_FIRE_RINGPAIR_AVALON" },
      { nome: "Cajado do Andarilho Flamejante", item: "MAIN_FIRESTAFF_CRYSTAL" },
    ],
  },
  {
    chave: "gelo",
    nome: "Gelo",
    emoji: "❄️",
    armas: [
      { nome: "Cajado de Gelo", item: "MAIN_FROSTSTAFF" },
      { nome: "Cajado de Gelo Elevado", item: "2H_FROSTSTAFF" },
      { nome: "Cajado Glacial", item: "2H_GLACIALSTAFF" },
      { nome: "Cajado Enregelante", item: "MAIN_FROSTSTAFF_KEEPER" },
      { nome: "Cajado de Sincelo", item: "2H_ICEGAUNTLETS_HELL" },
      { nome: "Prisma Geleterno", item: "2H_ICECRYSTAL_UNDEAD" },
      { nome: "Uivo Frio", item: "MAIN_FROSTSTAFF_AVALON" },
      { nome: "Cajado Ártico", item: "2H_FROSTSTAFF_CRYSTAL" },
    ],
  },
  {
    chave: "arcano",
    nome: "Arcano",
    emoji: "🔮",
    armas: [
      { nome: "Cajado Arcano", item: "MAIN_ARCANESTAFF" },
      { nome: "Cajado Arcano Elevado", item: "2H_ARCANESTAFF" },
      { nome: "Cajado Enigmático", item: "2H_ENIGMATICSTAFF" },
      { nome: "Cajado Feiticeiro", item: "MAIN_ARCANESTAFF_UNDEAD" },
      { nome: "Cajado Oculto", item: "2H_ARCANESTAFF_HELL" },
      { nome: "Local Malévolo", item: "2H_ENIGMATICORB_MORGANA" },
      { nome: "Som Equilibrado", item: "2H_ARCANE_RINGPAIR_AVALON" },
      { nome: "Cajado Astral", item: "2H_ARCANESTAFF_CRYSTAL" },
    ],
  },
  {
    chave: "sagrado",
    nome: "Sagrado",
    emoji: "🕊️",
    armas: [
      { nome: "Cajado Sagrado", item: "MAIN_HOLYSTAFF" },
      { nome: "Cajado Sagrado Elevado", item: "2H_HOLYSTAFF" },
      { nome: "Cajado Divino", item: "2H_DIVINESTAFF" },
      { nome: "Cajado Avivador", item: "MAIN_HOLYSTAFF_MORGANA" },
      { nome: "Cajado Corrompido", item: "2H_HOLYSTAFF_HELL" },
      { nome: "Cajado da Redenção", item: "2H_HOLYSTAFF_UNDEAD" },
      { nome: "Queda Santa", item: "MAIN_HOLYSTAFF_AVALON" },
      { nome: "Cajado Exaltado", item: "2H_HOLYSTAFF_CRYSTAL" },
    ],
  },
  {
    chave: "amaldicoado",
    nome: "Amaldiçoado",
    emoji: "💀",
    armas: [
      { nome: "Cajado Amaldiçoado", item: "MAIN_CURSEDSTAFF" },
      { nome: "Cajado Amaldiçoado Elevado", item: "2H_CURSEDSTAFF" },
      { nome: "Cajado Demoníaco", item: "2H_DEMONICSTAFF" },
      { nome: "Cajado Execrado", item: "MAIN_CURSEDSTAFF_UNDEAD" },
      { nome: "Caveira Amaldiçoada", item: "2H_SKULLORB_HELL" },
      { nome: "Cajado da Danação", item: "2H_CURSEDSTAFF_MORGANA" },
      { nome: "Chama-sombra", item: "MAIN_CURSEDSTAFF_AVALON" },
      { nome: "Cajado Pútrido", item: "MAIN_CURSEDSTAFF_CRYSTAL" },
    ],
  },
  {
    chave: "natureza",
    nome: "Natureza",
    emoji: "🌿",
    armas: [
      { nome: "Cajado da Natureza", item: "MAIN_NATURESTAFF" },
      { nome: "Cajado da Natureza Elevado", item: "2H_NATURESTAFF" },
      { nome: "Cajado Selvagem", item: "2H_WILDSTAFF" },
      { nome: "Cajado Druídico", item: "MAIN_NATURESTAFF_KEEPER" },
      { nome: "Cajado Pustulento", item: "2H_NATURESTAFF_HELL" },
      { nome: "Cajado Rampante", item: "2H_NATURESTAFF_KEEPER" },
      { nome: "Raiz Férrea", item: "MAIN_NATURESTAFF_AVALON" },
      { nome: "Cajado de Crosta Forjada", item: "MAIN_NATURESTAFF_CRYSTAL" },
    ],
  },
  {
    chave: "metamorfo",
    nome: "Metamorfo",
    emoji: "🐺",
    armas: [
      { nome: "Cajado de Predador", item: "2H_SHAPESHIFTER_SET1" },
      { nome: "Cajado Enraizado", item: "2H_SHAPESHIFTER_SET2" },
      { nome: "Cajado Primitivo", item: "2H_SHAPESHIFTER_SET3" },
      { nome: "Cajado da Lua de Sangue", item: "2H_SHAPESHIFTER_MORGANA" },
      { nome: "Cajado Endemoniado", item: "2H_SHAPESHIFTER_HELL" },
      { nome: "Cajado Rúnico da Terra", item: "2H_SHAPESHIFTER_KEEPER" },
      { nome: "Cajado Invocador da Luz", item: "2H_SHAPESHIFTER_AVALON" },
      { nome: "Cajado Petrificante", item: "2H_SHAPESHIFTER_CRYSTAL" },
    ],
  },
];

// Funções genéricas (tag = grupo de emoji que o bot já usava).
export const FUNCOES_GENERICAS: Array<{ tag: string; nome: string }> = [
  { tag: "curandeiro", nome: "HEALER" },
  { tag: "defensivo", nome: "TANK" },
  { tag: "defensivo", nome: "OFF TANK" },
  { tag: "suporte", nome: "SUPORTE" },
  { tag: "lutador", nome: "DPS" },
];

export const SUFIXO_QUALQUER = " (QUALQUER)";

// Nome da vaga genérica de uma árvore: "NATUREZA (QUALQUER)".
export function nomeArvoreGenerica(a: Arvore): string {
  return a.nome.toUpperCase() + SUFIXO_QUALQUER;
}

// Classes completas (":tag: NOME") na ordem em que aparecem: funções, depois cada árvore com a
// vaga genérica e as armas.
export function classeDaArma(a: Arvore, arma: Arma): string {
  return `:${a.chave}: ${arma.nome.toUpperCase()}`;
}
export function classeGenericaDaArvore(a: Arvore): string {
  return `:${a.chave}: ${nomeArvoreGenerica(a)}`;
}
export const CLASSES_FUNCOES: string[] = FUNCOES_GENERICAS.map((f) => `:${f.tag}: ${f.nome}`);
export const CLASSES_ARMAS: string[] = ARVORES.flatMap((a) => [
  classeGenericaDaArvore(a),
  ...a.armas.map((arma) => classeDaArma(a, arma)),
]);

// Chave de comparação (igual a chaveFuncao do bot de conteúdo: sem tag/emoji/pontuação, maiúscula).
export function chave(texto: string): string {
  return texto
    .replace(/^\(\d+\/\d+\)/, "")
    .replace(/<a?:\w+:\d+>/g, "")
    .replace(/:\w+:/g, "")
    .replace(/<@!?&?\d+>/g, "")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

const ARVORE_POR_CHAVE = new Map<string, Arvore>();
for (const a of ARVORES) {
  ARVORE_POR_CHAVE.set(chave(nomeArvoreGenerica(a)), a);
  for (const arma of a.armas) ARVORE_POR_CHAVE.set(chave(arma.nome), a);
}

// Árvore de uma classe (arma ou genérica da árvore); null para funções e classes antigas.
export function arvoreDaClasse(classe: string): Arvore | null {
  return ARVORE_POR_CHAVE.get(chave(classe)) ?? null;
}

// Árvore pela vaga genérica ("NATUREZA (QUALQUER)"); null se não for genérica de árvore.
export function arvoreGenerica(classe: string): Arvore | null {
  const k = chave(classe);
  return ARVORES.find((a) => chave(nomeArvoreGenerica(a)) === k) ?? null;
}

// A classe que a pessoa marcou no Pool serve pra vaga? Igual, ou o Pool marcou a árvore e a vaga
// é uma arma (ou a genérica) dessa árvore.
export function classeAtendeVaga(classeDaPessoa: string, classeDaVaga: string): boolean {
  if (chave(classeDaPessoa) === chave(classeDaVaga)) return true;
  const arvorePessoa = arvoreGenerica(classeDaPessoa);
  return arvorePessoa !== null && arvoreDaClasse(classeDaVaga)?.chave === arvorePessoa.chave;
}
