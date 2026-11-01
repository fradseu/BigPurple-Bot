// rodada.ts - O trabalho agendado do killboard (chamado pela function `killboard` via pg_cron):
//   rodarKillboard()   — a cada 5 min: posta kills, mortes e assistências novas dos Membros.
//   postarRankings()   — toda segunda: posta o top 10 dos últimos 30 dias em cada canal ativo.
import { buscarEventosDaGuilda } from "./albion.ts";
import {
  cargoMembroDoRecrutamento,
  ConfigKillboard,
  eventosJaPostados,
  guildaAlbion,
  lerConfigsAtivas,
  postadosRecentes,
  registrarPostado,
  vinculosAprovados,
} from "./db.ts";
import { cargosDoMembro, discord, membroPeloNome, postarEmbed } from "./discord.ts";
import {
  Acompanhados,
  classificarEvento,
  eventosParaPostar,
  jogadoresDoEvento,
  montarEmbedEvento,
  montarEmbedRanking,
  montarRanking,
} from "./dominio.ts";

// Teto por execução (o agendador roda a cada 5 min; o que sobrar sai na próxima).
const MAX_POSTS_POR_EXECUCAO = 15;
// Respeita o limite do Discord (5 mensagens / 5 s por canal) com folga.
const PAUSA_ENTRE_POSTS_MS = 1_200;
// Nunca posta evento mais velho que isso, mesmo que o killboard tenha ficado parado.
const JANELA_MAXIMA_MS = 24 * 60 * 60 * 1000;
// Período do ranking (o registro de postados é guardado por 30 dias).
export const DIAS_RANKING = 30;

export interface ResultadoKillboard {
  guild_id: string;
  eventos_lidos?: number;
  postados?: number;
  erro?: string;
}

async function rodarServidor(cfg: ConfigKillboard): Promise<ResultadoKillboard> {
  const guilda = await guildaAlbion(cfg.albion_guild_id);
  if (!guilda) return { guild_id: cfg.guild_id, erro: "nenhuma guilda do Albion cadastrada" };

  const cargo = cfg.cargo_membro_id ?? await cargoMembroDoRecrutamento(cfg.guild_id);
  if (!cargo) return { guild_id: cfg.guild_id, erro: "cargo de Membro não definido" };

  // Vínculo Discord <-> Albion: 1º o do recrutamento; quem não tiver, pelo apelido (abaixo).
  const vinculos = await vinculosAprovados(cfg.guild_id);

  const eventos = await buscarEventosDaGuilda(guilda.id);
  const desde = new Date(Math.max(new Date(cfg.ativado_em).getTime(), Date.now() - JANELA_MAXIMA_MS));
  const jaPostados = await eventosJaPostados(cfg.guild_id, eventos.map((e) => e.EventId));
  const candidatos = eventosParaPostar(eventos, jaPostados, desde, eventos.length);

  // Confere o cargo só de quem aparece em algum evento novo (uma consulta por pessoa). Jogador da
  // guilda sem vínculo do recrutamento: procura no Discord alguém com o mesmo nome do jogo.
  const temCargo = new Map<string, boolean>();
  const procurados = new Set<string>();
  const acompanhados: Acompanhados = new Map();
  const daGuilda = guilda.nome.toLowerCase();
  for (const evento of candidatos) {
    const envolvidos = [evento.Killer, evento.Victim, ...(evento.Participants ?? [])];
    for (const j of envolvidos) {
      if (vinculos.has(j.Id) || procurados.has(j.Id) || j.GuildName?.toLowerCase() !== daGuilda) continue;
      procurados.add(j.Id);
      const achado = await membroPeloNome(cfg.guild_id, j.Name);
      if (achado) {
        vinculos.set(j.Id, achado.id);
        temCargo.set(achado.id, achado.roles.includes(cargo));
      }
    }
    for (const playerId of jogadoresDoEvento(evento)) {
      const discordId = vinculos.get(playerId);
      if (!discordId || acompanhados.has(playerId)) continue;
      if (!temCargo.has(discordId)) {
        const cargos = await cargosDoMembro(cfg.guild_id, discordId);
        temCargo.set(discordId, cargos?.includes(cargo) ?? false);
      }
      if (temCargo.get(discordId)) acompanhados.set(playerId, discordId);
    }
  }

  let postados = 0;
  for (const evento of candidatos) {
    if (postados >= MAX_POSTS_POR_EXECUCAO) break;
    const c = classificarEvento(evento, acompanhados);
    if (!c) continue;
    if (postados > 0) await new Promise((r) => setTimeout(r, PAUSA_ENTRE_POSTS_MS));
    const msg = await postarEmbed(cfg.canal_id, montarEmbedEvento(evento, c, acompanhados));
    await registrarPostado(
      cfg.guild_id,
      evento.EventId,
      c.tipo,
      msg.id,
      evento.TotalVictimKillFame ?? 0,
      c.membros.map((id) => acompanhados.get(id)!),
    );
    postados++;
  }

  return { guild_id: cfg.guild_id, eventos_lidos: eventos.length, postados };
}

export async function rodarKillboard(): Promise<ResultadoKillboard[]> {
  const resultados: ResultadoKillboard[] = [];
  for (const cfg of await lerConfigsAtivas()) {
    try {
      resultados.push(await rodarServidor(cfg));
    } catch (err) {
      resultados.push({ guild_id: cfg.guild_id, erro: err instanceof Error ? err.message : String(err) });
    }
  }
  return resultados;
}

export async function postarRankings(): Promise<ResultadoKillboard[]> {
  const resultados: ResultadoKillboard[] = [];
  for (const cfg of await lerConfigsAtivas()) {
    try {
      const ranking = montarRanking(await postadosRecentes(cfg.guild_id, DIAS_RANKING));
      await postarEmbed(cfg.canal_id, montarEmbedRanking(ranking, DIAS_RANKING));
      resultados.push({ guild_id: cfg.guild_id, postados: 1 });
    } catch (err) {
      resultados.push({ guild_id: cfg.guild_id, erro: err instanceof Error ? err.message : String(err) });
    }
  }
  return resultados;
}

const TIPOS: Record<number, string> = { 0: "texto", 2: "voz", 4: "categoria", 5: "anúncios", 13: "palco", 15: "fórum", 16: "mídia" };

interface Canal {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id?: string | null;
  topic?: string | null;
  permission_overwrites?: Array<{ id: string; type: number; allow: string; deny: string }>;
}
interface Cargo { id: string; name: string; position: number; managed: boolean; permissions: string }

// Categorias, canais e cargos do servidor (só leitura; não lê mensagens nem membros). Serve pra
// planejar novas seções do servidor.
export async function estruturaDoServidor(guildId: string) {
  const [servidor, canais, cargos] = await Promise.all([
    discord<{ name: string; approximate_member_count?: number }>(`/guilds/${guildId}?with_counts=true`),
    discord<Canal[]>(`/guilds/${guildId}/channels`),
    discord<Cargo[]>(`/guilds/${guildId}/roles`),
  ]);
  const nomeCargo = new Map(cargos.map((c) => [c.id, c.name]));
  const perms = (c: Canal) =>
    (c.permission_overwrites ?? []).map((o) => ({
      alvo: o.type === 0 ? `cargo:${nomeCargo.get(o.id) ?? o.id}` : `usuario:${o.id}`,
      allow: o.allow,
      deny: o.deny,
    }));
  const filhos = (pai: string | null) =>
    canais.filter((c) => c.type !== 4 && (c.parent_id ?? null) === pai).sort((a, b) => a.position - b.position)
      .map((c) => ({ id: c.id, nome: c.name, tipo: TIPOS[c.type] ?? String(c.type), topico: c.topic ?? undefined, permissoes: perms(c) }));
  return {
    servidor: servidor.name,
    membros: servidor.approximate_member_count,
    sem_categoria: filhos(null),
    categorias: canais.filter((c) => c.type === 4).sort((a, b) => a.position - b.position)
      .map((cat) => ({ id: cat.id, nome: cat.name, permissoes: perms(cat), canais: filhos(cat.id) })),
    cargos: cargos.sort((a, b) => b.position - a.position)
      .map((c) => ({ id: c.id, nome: c.name, posicao: c.position, de_bot: c.managed, permissoes: c.permissions })),
  };
}
