// killboard.ts - Duas pontas do killboard:
//   1. rodarKillboard(): chamada pelo agendador (pg_cron -> POST /internal/killboard). Para cada
//      servidor ativo, lê os eventos da guilda no Albion e posta os que envolvem membros com o
//      cargo de Membro.
//   2. handleComandoKillboard(): /killboard ativar | desativar | status (só quem gerencia o servidor)
//      e /killboard ranking (qualquer um; top 10 dos últimos 30 dias).
import { buscarEventosDaGuilda } from "../albion/eventos.ts";
import {
  ativar,
  cargoMembroDoRecrutamento,
  ConfigKillboard,
  desativar,
  eventosJaPostados,
  guildaAlbionPadrao,
  lerConfig,
  lerConfigsAtivas,
  postadosRecentes,
  registrarPostado,
  vinculosAprovados,
} from "../db/killboard.ts";
import { buscarMembro, editarRespostaOriginal, enviarMensagem } from "../discord/rest.ts";
import { deferredReply, reply } from "../discord/responses.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import {
  Acompanhados,
  classificarEvento,
  eventosParaPostar,
  jogadoresDoEvento,
  lerSubcomando,
  montarEmbedEvento,
  montarEmbedRanking,
  montarRanking,
  podeConfigurar,
} from "../domain/killboard.ts";
import { HandlerResult } from "./context.ts";

// Teto por execução (o agendador roda a cada 5 min; o que sobrar sai na próxima).
const MAX_POSTS_POR_EXECUCAO = 15;
// Respeita o limite do Discord (5 mensagens / 5 s por canal) com folga.
const PAUSA_ENTRE_POSTS_MS = 1_200;
// Nunca posta evento mais velho que isso, mesmo que o killboard tenha ficado parado.
const JANELA_MAXIMA_MS = 24 * 60 * 60 * 1000;
// Período do ranking (o registro de postados é guardado por 30 dias).
const DIAS_RANKING = 30;

export interface ResultadoKillboard {
  guild_id: string;
  eventos_lidos?: number;
  postados?: number;
  erro?: string;
}

async function rodarServidor(cfg: ConfigKillboard): Promise<ResultadoKillboard> {
  const albionGuildId = cfg.albion_guild_id ?? await guildaAlbionPadrao();
  if (!albionGuildId) return { guild_id: cfg.guild_id, erro: "nenhuma guilda do Albion cadastrada" };

  const cargo = cfg.cargo_membro_id ?? await cargoMembroDoRecrutamento(cfg.guild_id);
  if (!cargo) return { guild_id: cfg.guild_id, erro: "cargo de Membro não definido" };

  const vinculos = await vinculosAprovados(cfg.guild_id);
  if (vinculos.size === 0) return { guild_id: cfg.guild_id, eventos_lidos: 0, postados: 0 };

  const eventos = await buscarEventosDaGuilda(albionGuildId);
  const desde = new Date(Math.max(new Date(cfg.ativado_em).getTime(), Date.now() - JANELA_MAXIMA_MS));
  const jaPostados = await eventosJaPostados(cfg.guild_id, eventos.map((e) => e.EventId));
  const candidatos = eventosParaPostar(eventos, jaPostados, desde, eventos.length);

  // Confere o cargo só de quem aparece em algum evento novo (uma consulta por pessoa).
  const temCargo = new Map<string, boolean>();
  const acompanhados: Acompanhados = new Map();
  for (const evento of candidatos) {
    for (const playerId of jogadoresDoEvento(evento)) {
      const discordId = vinculos.get(playerId);
      if (!discordId || acompanhados.has(playerId)) continue;
      if (!temCargo.has(discordId)) {
        const membro = await buscarMembro(cfg.guild_id, discordId);
        temCargo.set(discordId, membro?.roles?.includes(cargo) ?? false);
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
    const msg = await enviarMensagem(cfg.canal_id, { embeds: [montarEmbedEvento(evento, c, acompanhados)] });
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
  const configs = await lerConfigsAtivas();
  const resultados: ResultadoKillboard[] = [];
  for (const cfg of configs) {
    try {
      resultados.push(await rodarServidor(cfg));
    } catch (err) {
      resultados.push({ guild_id: cfg.guild_id, erro: err instanceof Error ? err.message : String(err) });
    }
  }
  return resultados;
}

export function handleComandoKillboard(interaction: DiscordInteraction): HandlerResult {
  const guildId = interaction.guild_id;
  if (!guildId) return { immediate: reply("Use este comando dentro do servidor.", { ephemeral: true }) };
  const sub = lerSubcomando(interaction.data?.options);
  if (!sub) return { immediate: reply("Subcomando inválido.", { ephemeral: true }) };

  // Ranking é público e aparece pra todo mundo no canal.
  if (sub.nome === "ranking") {
    const { application_id, token } = interaction;
    return {
      immediate: deferredReply(false),
      background: async () => {
        const ranking = montarRanking(await postadosRecentes(guildId, DIAS_RANKING));
        await editarRespostaOriginal(application_id, token, { embeds: [montarEmbedRanking(ranking, DIAS_RANKING)] });
      },
    };
  }

  if (!podeConfigurar(interaction.member?.permissions)) {
    return { immediate: reply("Só quem pode **Gerenciar servidor** configura o killboard.", { ephemeral: true }) };
  }

  const quem = getInteractionUserId(interaction);
  const { application_id: app, token } = interaction;
  const responder = (content: string) => editarRespostaOriginal(app, token, { content });

  return {
    immediate: deferredReply(true),
    background: async () => {
      if (sub.nome === "ativar") {
        const canal = sub.valores.canal;
        const cargo = sub.valores.cargo ?? null;
        await ativar(guildId, canal, cargo, quem);
        const cargoEfetivo = cargo ?? await cargoMembroDoRecrutamento(guildId);
        await responder(
          `✅ Killboard ativado em <#${canal}>.\n` +
            (cargoEfetivo
              ? `Cargo exigido: <@&${cargoEfetivo}>.`
              : "⚠️ Nenhum cargo definido: passe `cargo:` ou configure o cargo de Membro no recrutamento.") +
            "\nSó entram eventos a partir de agora. Kills, mortes e assistências aparecem em até ~10 min.",
        );
        return;
      }

      if (sub.nome === "desativar") {
        const ok = await desativar(guildId, quem);
        await responder(ok ? "⏸️ Killboard desativado." : "O killboard não estava configurado aqui.");
        return;
      }

      if (sub.nome === "status") {
        const cfg = await lerConfig(guildId);
        if (!cfg) {
          await responder("Killboard não configurado. Use `/killboard ativar canal:#canal`.");
          return;
        }
        const cargo = cfg.cargo_membro_id ?? await cargoMembroDoRecrutamento(guildId);
        const vinculos = await vinculosAprovados(guildId);
        await responder(
          `${cfg.ativo ? "🟢 Ativo" : "⏸️ Desativado"} · canal <#${cfg.canal_id}>\n` +
            `Cargo: ${cargo ? `<@&${cargo}>` : "não definido"}\n` +
            `Jogadores com vínculo Discord ↔ Albion (aprovados no recrutamento): ${vinculos.size}`,
        );
        return;
      }

      await responder("Subcomando desconhecido.");
    },
  };
}
