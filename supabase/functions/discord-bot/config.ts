// config.ts - Central de Configurações do Clã (portado do config.js do v1, tipado)

export interface OpcaoConfig {
  label: string;
  value: string;
}

export interface DificuldadeValor {
  label: string;
  value: number;
}

export interface DificuldadeImagem {
  label: string;
  value: string; // URL da imagem
}

export interface BonusConfig {
  label: string;
  value: string;
  emoji: string;
}

// Nome da categoria onde as salas de voz de PT são criadas. O bot procura
// por esse nome (sem diferenciar maiúsculas/minúsculas); se não achar, cria
// a categoria do zero. Precisa bater com o nome exato da categoria já
// existente no servidor, se quiser reusar ela.
export const NOME_CATEGORIA_SALAS_VOZ = "⸻🔹  SALA DE VOZ  🔹⸻";

// Emoji PADRÃO do Discord de cada tag (":arcolongo:", ":curandeiro:" etc) usada em FUNCOES.
// É o que aparece quando o servidor NÃO tem um emoji customizado com o mesmo nome — emoji
// padrão funciona em qualquer servidor, sem depender de upload. Se um dia o servidor tiver
// emojis customizados com esses nomes (curandeiro, arcolongo, defensivo, suporte, lutador),
// eles têm prioridade (veja domain/emoji.ts).
export const EMOJIS_UNICODE_FUNCAO: Record<string, string> = {
  curandeiro: "💚",
  arcolongo: "🏹",
  defensivo: "🛡️",
  suporte: "✨",
  lutador: "⚔️",
};

// IDs de emojis customizados de OUTRO servidor (o antigo). NÃO servem mais pra renderizar:
// o bot só consegue usar emoji de servidor em que está, e aqui eles apareciam como texto
// cru (":defensivo:"). Fica só porque o /diagnostico (desativado) ainda lê esta lista.
// Prefixo "a:" na frente do id = emoji animado.
export const EMOJIS_FUNCAO: Record<string, string> = {
  curandeiro: "1417684586795892806",
  arcolongo: "1417684657037643916",
  defensivo: "1417684507510968350",
  suporte: "1417684619972841482",
  lutador: "1417684554281386055",
};

// Se quiser mudar o nome de uma classe ou adicionar uma nova (ex: "🧙‍♂️ SUPORTE"), mexa só aqui!
export const FUNCOES: string[] = [
  //:curandeiro: :arcolongo: :defensivo::suporte: :lutador:
  //básicos
  ":arcolongo: BADÔNICO",
  ":suporte: CHAMA SOMBRA",
  ":lutador: FULGURANTE",
  ":arcolongo: FURA-BRUMA",
  ":curandeiro: MAIN HEALER",
  ":defensivo: TANK",
  //opcionais
  ":lutador: DPS",
  ":defensivo: OFF TANK",
  ":lutador: SCOUT",
  ":defensivo: STOPPER CALL",
  ":suporte: SUPORTE",
  ":defensivo: TRANSPORTE",
  //opcionais
  ":suporte: QUEBRA REINOS",
  ":lutador: ADAGA DE UMA MÃO",
  ":arcolongo: BESTA LEVE",
  ":lutador: CAÇA-ESPIRÍTOS",
  ":suporte: CORTA CURA",
  ":suporte: ENIGMÁTICO",
  ":arcolongo: LANÇA VIROTES",
  ":suporte: MONGE NEGRO",
  ":curandeiro: NATUREZA",
  ":lutador: PRISMA ",
  ":curandeiro: PT HEALER",
];

export const ATIVIDADES: OpcaoConfig[] = [
  { label: "DG Grupo", value: "DG Grupo" },
  { label: "DG Fixa", value: "DG Fixa" },
  { label: "Caçada em Grupo", value: "Caçada" },
  { label: "Guerra de Facção", value: "Guerra de Facção" },
  { label: "Roaming / Gank", value: "Roaming/Gank" },
  { label: "Warcamp", value: "Warcamp" },
  { label: "Dragão (evento da temporada)", value: "Dragão" },
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

export const CIDADES: OpcaoConfig[] = [
  { label: "Thetford Royal", value: "Thetford Royal" }, //dificuldades 0.01
  { label: "Bridgewatch Royal", value: "Bridgewatch Royal" }, //dificuldades 0.01
  { label: "Fort Sterling Royal", value: "Fort Sterling Royal" }, //dificuldades 0.01
  { label: "Lymhurst Royal", value: "Lymhurst Royal" }, //dificuldades 0.01
  { label: "Martlock Royal", value: "Martlock Royal" }, //dificuldades 0.01
  { label: "Caerleon ", value: "Caerleon" }, //dificuldades 0.55

  { label: "Brecilien", value: "Brecilien" }, //dificuldades 0.55
  { label: "Morgana's Rest", value: "Morgana's Rest" }, //dificuldades 0.55
  { label: "Arthur's Rest", value: "Arthur's Rest" }, //dificuldades 0.55
  { label: "Merlyn's Rest", value: "Merlyn's Rest" }, //dificuldades 0.55

  { label: "Thetford Portal", value: "Thetford Portal" }, //dificuldades 0.50
  { label: "Bridgewatch Portal", value: "Bridgewatch Portal" }, //dificuldades 0.60
  { label: "Fort Sterling Portal", value: "Fort Sterling Portal" }, //dificuldades 0.70
  { label: "Lymhurst Portal", value: "Lymhurst Portal" }, //dificuldades 0.80
  { label: "Martlock Portal", value: "Martlock Portal" }, //dificuldades 0.80
];

export const ZONAS: OpcaoConfig[] = [
  { label: "🟡 Zona Amarela", value: "Zona Amarela" },
  { label: "🔴 Zona Vermelha", value: "Zona Vermelha" },
  { label: "⚫ Zona Black", value: "Zona Black" },
  { label: "🌌 Estradas de Avalon", value: "Estradas de Avalon" },
];

// Usado por calcularDificuldade() — atividades, zona e cidade (ponto de encontro)
// entram todos na média.
export const DIFICULDADES_VALUE: DificuldadeValor[] = [
  // --- Zonas ---
  { label: "Zona Amarela", value: 0.01 }, // Sem PvP forçado, risco quase nulo
  { label: "Zona Vermelha", value: 0.4 }, // Full loot, mas dá pra fugir pra NPC city
  { label: "Zona Black", value: 0.65 }, // Full loot, mais concorrida e valiosa que a Vermelha
  { label: "Estradas de Avalon", value: 0.9 }, // Sem fast-travel, labiríntico, full loot

  // --- Atividades ---
  { label: "DG Fixa", value: 0.2 }, // Instanciada, não pode ser invadida
  { label: "Spec de arma", value: 0.1 }, // Normalmente feito em conteúdo instanciado/seguro
  { label: "Baús Azul", value: 0.2 }, // Baixo valor, raramente em black profunda
  { label: "Apagas", value: 0.35 }, // Farm repetitivo, geralmente não busca PvP
  { label: "Guerra de Facção", value: 0.5 }, // PvP organizado, mas com suporte de facção
  { label: "Aliança DG", value: 0.55 }, // DG em grupo grande, mas com backup da aliança
  { label: "Caçada", value: 0.25 }, // Grupo caçando, geralmente na Amarela/Vermelha
  { label: "DG Grupo", value: 0.6 }, // Masmorra open-world, pode ser invadida
  { label: "Coleta na Black", value: 0.6 }, // Exposto, alvo comum de gank
  { label: "Transporte para Caerleon", value: 0.55 }, // Carga valiosa, lento, alvo primário de gank
  { label: "Baús Dourado", value: 0.85 }, // Alto valor em black zone, disputado
  { label: "Roaming/Gank", value: 0.75 }, // Busca ativa por PvP, alto risco por natureza
  { label: "Warcamp", value: 0.5 }, // ESTIMATIVA: PvP de facção em área disputada (ajuste se achar mais/menos perigoso)
  { label: "Dragão", value: 0.7 }, // ESTIMATIVA: evento da temporada em open world, concorrido (ajuste conforme a experiência)
  { label: "Aliança Guerra de Facção", value: 0.75 }, // Guerra em larga escala, muita gente e valor em jogo
  { label: "Coleta na Avalon", value: 0.85 }, // Exposto e sem rota fácil de fuga
  { label: "Aliança Avalon", value: 0.9 }, // Operação de alto valor na região mais punitiva
  { label: "Aliança Zerg versus Zerg", value: 1.0 }, // Maior escala de perda simultânea do jogo

  // --- Cidades (ponto de encontro) ---
  { label: "Thetford Royal", value: 0.01 }, // Continente Royal, zona 100% segura
  { label: "Bridgewatch Royal", value: 0.01 },
  { label: "Fort Sterling Royal", value: 0.01 },
  { label: "Lymhurst Royal", value: 0.01 },
  { label: "Martlock Royal", value: 0.01 },
  { label: "Caerleon", value: 0.55 }, // Capital black zone, movimentada e disputada
  { label: "Brecilien", value: 0.55 }, // Cidade de facção, zona vermelha ao redor
  { label: "Morgana's Rest", value: 0.55 }, // Cidade de descanso de Avalon
  { label: "Arthur's Rest", value: 0.55 },
  { label: "Merlyn's Rest", value: 0.55 },
  { label: "Thetford Portal", value: 0.5 }, // Portal de entrada pra Outlands, alvo de camping
  { label: "Bridgewatch Portal", value: 0.6 },
  { label: "Fort Sterling Portal", value: 0.7 },
  { label: "Lymhurst Portal", value: 0.8 },
  { label: "Martlock Portal", value: 0.8 },
];

export const DIFICULDADES: DificuldadeImagem[] = [
  {
    label: "Alta dificuldade, Tier S:",
    value:
      "https://media.discordapp.net/attachments/1310499465504882749/1421659769130713189/NIVEL1.png?ex=6a71df96&is=6a708e16&hm=cd79a0245eece41fe433cced5dfc48387026c666ded22477a306b06798f4f8cd&=&format=webp&quality=lossless&width=640&height=79",
  },
  {
    label: "Alta dificuldade, Tier A:",
    value:
      "https://media.discordapp.net/attachments/1310499465504882749/1421659799770370058/NIVEL2.png?ex=6a71df9d&is=6a708e1d&hm=2bb7650feb62f327d6a90b30cddee9719f4fe13ade098be9dd30f0c0e9bd6e48&=&format=webp&quality=lossless&width=640&height=79",
  },
  {
    label: "Alta dificuldade, Tier B:",
    value:
      "https://media.discordapp.net/attachments/1310499465504882749/1421659879445368924/NIVEL3.png?ex=6a71dfb0&is=6a708e30&hm=a73ce2bacfcc125b89ceee0c5048ee6432ba35a1109812657fad9d99dd00659d&=&format=webp&quality=lossless&width=640&height=79",
  },
  {
    label: "Alta dificuldade, Tier C:",
    value:
      "https://media.discordapp.net/attachments/1310499465504882749/1421659965076144248/NIVEL4.png?ex=6a71dfc4&is=6a708e44&hm=1152107c76509e128c554cb0341ead8064eb6209ffa74d4aa5eecfaf48bf2e41&=&format=webp&quality=lossless&width=640&height=79",
  },
  {
    label: "Patrocinado:",
    value:
      "https://media.discordapp.net/attachments/1310499465504882749/1421660012245422142/NIVEL5.png?ex=6a71dfd0&is=6a708e50&hm=6ce611cfaf17735af5518caa1a5a6d68352109f7c916e7edb476054b5185f2b8&=&format=webp&quality=lossless&width=640&height=79",
  },
  {
    label: "Aliança:",
    value:
      "https://media.discordapp.net/attachments/1310499465504882749/1421660046076678296/NIVEL6.png?ex=6a71dfd8&is=6a708e58&hm=196958202548cc31045367663a7d4c18f555e9a5dd48e184b281e16b61ea2455&=&format=webp&quality=lossless&width=640&height=79",
  },
];

// Botões de bônus que aparecem no painel público. O jogador precisa já estar
// numa vaga pra poder marcar/desmarcar (o handler valida isso).
export const BONUS: BonusConfig[] = [
  { label: "Mana", value: "mana", emoji: "⚗️" },
  { label: "Runa", value: "runa", emoji: "💢" },
  { label: "Reset", value: "reset", emoji: "♻️" },
  { label: "Guardião", value: "guardiao", emoji: "🩹" },
];
