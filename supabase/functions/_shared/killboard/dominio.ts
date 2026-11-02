// dominio.ts - Regras puras do killboard (sem rede, sem banco): decidir se um evento do Albion
// interessa, se é kill, morte ou assistência, e montar o embed. Testado em dominio_test.ts.
// Embed no formato da API do Discord (compatível com o DiscordEmbed do discord-bot).
export interface DiscordEmbed {
  title?: string;
  url?: string;
  description?: string;
  color?: number;
  thumbnail?: { url: string };
  image?: { url: string };
  fields?: Array<{ name: string; value: string; inline?: boolean }>;
  timestamp?: string;
  footer?: { text: string };
}

// Só o que usamos de um evento de /events. Todo campo opcional pode faltar.
export interface JogadorEvento {
  Id: string;
  Name: string;
  GuildName?: string | null;
  AllianceName?: string | null;
  AverageItemPower?: number;
  DamageDone?: number;
  SupportHealingDone?: number;
  Equipment?: { MainHand?: { Type?: string } | null } | null;
}

export interface EventoAlbion {
  EventId: number;
  TimeStamp: string;
  TotalVictimKillFame?: number;
  numberOfParticipants?: number;
  Killer: JogadorEvento;
  Victim: JogadorEvento;
  Participants?: JogadorEvento[];
}

export type TipoEvento = "kill" | "morte" | "assistencia";

// Jogador do Albion acompanhado -> usuário do Discord.
export type Acompanhados = Map<string, string>;

export interface Classificacao {
  tipo: TipoEvento;
  // Membros (player_id) envolvidos naquele papel.
  membros: string[];
}

// Ajudou de verdade: causou dano ou curou. O próprio matador não conta como assistência.
function assistentes(evento: EventoAlbion): JogadorEvento[] {
  return (evento.Participants ?? []).filter((p) =>
    p.Id !== evento.Killer.Id && ((p.DamageDone ?? 0) > 0 || (p.SupportHealingDone ?? 0) > 0)
  );
}

// Prioridade: kill > morte > assistência. Um membro morto por um inimigo é "morte" mesmo que
// outro membro tenha batido no inimigo antes (o Albion não junta esses dois lados).
export function classificarEvento(evento: EventoAlbion, acompanhados: Acompanhados): Classificacao | null {
  if (acompanhados.has(evento.Killer.Id)) {
    const ajudaram = assistentes(evento).filter((p) => acompanhados.has(p.Id)).map((p) => p.Id);
    return { tipo: "kill", membros: [evento.Killer.Id, ...ajudaram] };
  }
  if (acompanhados.has(evento.Victim.Id)) return { tipo: "morte", membros: [evento.Victim.Id] };
  const ajudaram = assistentes(evento).filter((p) => acompanhados.has(p.Id)).map((p) => p.Id);
  if (ajudaram.length > 0) return { tipo: "assistencia", membros: ajudaram };
  return null;
}

// Todos os player_id que aparecem no evento (pra saber de quem conferir o cargo).
export function jogadoresDoEvento(evento: EventoAlbion): string[] {
  const ids = [evento.Killer.Id, evento.Victim.Id, ...(evento.Participants ?? []).map((p) => p.Id)];
  return [...new Set(ids)];
}

// Eventos novos, do mais antigo pro mais recente (ordem de leitura no canal).
export function eventosParaPostar(
  eventos: EventoAlbion[],
  jaPostados: Set<number>,
  desde: Date,
  limite: number,
): EventoAlbion[] {
  return eventos
    .filter((e) => !jaPostados.has(e.EventId) && new Date(e.TimeStamp).getTime() >= desde.getTime())
    .sort((a, b) => new Date(a.TimeStamp).getTime() - new Date(b.TimeStamp).getTime())
    .slice(0, limite);
}

export function formatarFama(n: number | undefined): string {
  const v = n ?? 0;
  if (v >= 1_000_000) return `${(v / 1_000_000).toFixed(1).replace(".", ",")}M`;
  if (v >= 1_000) return `${(v / 1_000).toFixed(1).replace(".", ",")}k`;
  return String(v);
}

// Sem menções (@): fora do cache do aparelho o Discord mostra "usuário-desconhecido". Mostramos
// sempre o nome do jogo, que é igual para todo mundo e não notifica ninguém.
export function nomesDosMembros(evento: EventoAlbion, c: Classificacao): string[] {
  const nomes = new Map<string, string>(
    [evento.Killer, evento.Victim, ...(evento.Participants ?? [])].map((j) => [j.Id, j.Name]),
  );
  return c.membros.map((id) => nomes.get(id) ?? id);
}

export const COR_KILL = 0x2ecc71;
export const COR_MORTE = 0xe74c3c;
export const COR_ASSISTENCIA = 0x3498db;

export function urlEvento(eventId: number): string {
  return `https://albiononline.com/killboard/kill/${eventId}`;
}

export function urlItem(tipo: string): string {
  return `https://render.albiononline.com/v1/item/${encodeURIComponent(tipo)}.png`;
}

// Endereço público da imagem "Detalhes do abate" (function killboard-imagem).
// `?v=` muda quando o desenho muda (o Discord guarda a imagem pelo endereço).
export function urlCard(eventId: number): string {
  return `https://qroosefyfxefjrlhogrh.supabase.co/functions/v1/killboard-imagem/${eventId}.png?v=2`;
}

// Membros (player_id) do evento a partir dos nomes guardados em killboard_postados.
export function idsPorNome(evento: EventoAlbion, nomes: string[]): string[] {
  const porNome = new Map<string, string>(
    [evento.Killer, evento.Victim, ...(evento.Participants ?? [])].map((j) => [j.Name, j.Id]),
  );
  return nomes.map((n) => porNome.get(n)).filter((id): id is string => Boolean(id));
}

export function montarEmbedEvento(evento: EventoAlbion, c: Classificacao): DiscordEmbed {
  const quem = nomesDosMembros(evento, c).map((n) => `**${n}**`).join(", ");

  const titulo = c.tipo === "kill"
    ? `⚔️ ${evento.Killer.Name} matou ${evento.Victim.Name}`
    : c.tipo === "morte"
    ? `💀 ${evento.Victim.Name} morreu para ${evento.Killer.Name}`
    : `🤝 Assistência no abate de ${evento.Victim.Name}`;

  const rotulo = c.tipo === "kill" ? "Kill de" : c.tipo === "morte" ? "Morte de" : "Assistência de";

  // O card (equipamento dos dois, IP, fama) vai na imagem; o texto fica curto.
  return {
    title: titulo,
    url: urlEvento(evento.EventId),
    color: c.tipo === "kill" ? COR_KILL : c.tipo === "morte" ? COR_MORTE : COR_ASSISTENCIA,
    description: `${rotulo} ${quem}`,
    image: { url: urlCard(evento.EventId) },
    timestamp: new Date(evento.TimeStamp).toISOString(),
    footer: { text: `Killboard Big Purple · evento ${evento.EventId}` },
  };
}

// Lê as opções de /killboard <subcomando> ... em um objeto simples.
export interface OpcaoComando {
  name: string;
  type: number;
  value?: string | number | boolean;
  options?: OpcaoComando[];
}

export function lerSubcomando(
  opcoes: OpcaoComando[] | undefined,
): { nome: string; valores: Record<string, string> } | null {
  const sub = opcoes?.[0];
  if (!sub || sub.type !== 1) return null;
  const valores: Record<string, string> = {};
  for (const o of sub.options ?? []) if (o.value !== undefined) valores[o.name] = String(o.value);
  return { nome: sub.name, valores };
}

// Permissão de "Gerenciar servidor" (0x20) ou Administrador (0x8) no campo permissions da interação.
export function podeConfigurar(permissoes: string | undefined): boolean {
  if (!permissoes) return false;
  const p = BigInt(permissoes);
  return (p & 0x8n) !== 0n || (p & 0x20n) !== 0n;
}

// ---- Ranking dos últimos 30 dias ----

export interface LinhaRanking {
  tipo: TipoEvento;
  fama: number;
  discordIds: string[];
  // Nomes no jogo, na mesma ordem de discordIds (vazio em linhas antigas).
  nomes: string[];
}

export interface PosicaoRanking {
  discordId: string;
  nome: string;
  quantidade: number;
  fama: number;
}

export interface Ranking {
  kills: PosicaoRanking[];
  mortes: PosicaoRanking[];
  assistencias: PosicaoRanking[];
}

// Numa kill, o 1º membro é o matador e os demais contam como assistência (com a mesma fama).
// Desempate: mais fama primeiro.
export function montarRanking(linhas: LinhaRanking[], tamanho = 10): Ranking {
  const placares = { kills: new Map<string, PosicaoRanking>(), mortes: new Map(), assistencias: new Map() } as
    Record<keyof Ranking, Map<string, PosicaoRanking>>;
  const somar = (onde: keyof Ranking, discordId: string, fama: number, nome: string | undefined) => {
    const p = placares[onde].get(discordId) ?? { discordId, nome: nome ?? "?", quantidade: 0, fama: 0 };
    if (nome) p.nome = nome;
    p.quantidade++;
    p.fama += fama;
    placares[onde].set(discordId, p);
  };
  for (const l of linhas) {
    l.discordIds.forEach((d, i) => {
      const onde: keyof Ranking = l.tipo === "morte" ? "mortes" : l.tipo === "kill" && i === 0 ? "kills" : "assistencias";
      somar(onde, d, l.fama, l.nomes[i]);
    });
  }
  const top = (m: Map<string, PosicaoRanking>) =>
    [...m.values()].sort((a, b) => b.quantidade - a.quantidade || b.fama - a.fama).slice(0, tamanho);
  return { kills: top(placares.kills), mortes: top(placares.mortes), assistencias: top(placares.assistencias) };
}

const MEDALHAS = ["🥇", "🥈", "🥉"];

function linhasDoTop(posicoes: PosicaoRanking[], rotuloFama: string): string {
  if (posicoes.length === 0) return "_ninguém ainda_";
  return posicoes.map((p, i) =>
    `${MEDALHAS[i] ?? `\`${i + 1}.\``} **${p.nome}** — ${p.quantidade} · ${formatarFama(p.fama)} ${rotuloFama}`
  ).join("\n");
}

// Ranking no texto da mensagem (cabe mais que um campo de embed). O embed fica com título e rodapé.
export function textoRanking(r: Ranking): string {
  return [
    "**⚔️ Top Kills**",
    linhasDoTop(r.kills, "de fama"),
    "",
    "**🤝 Top Assistências**",
    linhasDoTop(r.assistencias, "de fama"),
    "",
    "**💀 Top Mortes**",
    linhasDoTop(r.mortes, "de fama perdida"),
  ].join("\n");
}

export function montarEmbedRanking(dias: number): DiscordEmbed {
  return {
    title: `🏆 Ranking do Killboard — últimos ${dias} dias`,
    color: 0x7b2cbf,
    footer: { text: "Só eventos de Membros postados no killboard" },
  };
}
