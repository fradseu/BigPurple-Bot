// killboard.ts - /killboard ativar | desativar | status (só quem gerencia o servidor) e
// /killboard ranking (qualquer um; top 10 dos últimos 30 dias). A rodada agendada que posta os
// eventos fica na function `killboard` (supabase/functions/killboard), com a lógica em
// _shared/killboard.
import {
  ativar,
  cargoMembroDoRecrutamento,
  desativar,
  lerConfig,
  postadosRecentes,
  vinculosAprovados,
} from "../../_shared/killboard/db.ts";
import { lerSubcomando, montarEmbedRanking, montarRanking, podeConfigurar } from "../../_shared/killboard/dominio.ts";
import { editarRespostaOriginal } from "../discord/rest.ts";
import { deferredReply, reply } from "../discord/responses.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { HandlerResult } from "./context.ts";

const DIAS_RANKING = 30;

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
