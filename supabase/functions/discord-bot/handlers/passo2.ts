// passo2.ts - Requisitos de entrada (tier / set de skip) e transição pro Passo 3.
// Confirma a interação primeiro (defer), banco/REST só depois em background.
import { deferredUpdate } from "../discord/responses.ts";
import { buscarEmojisDaGuilda, editarRespostaOriginal, enviarFollowUp } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { obterEstadoWizard, salvarEstadoWizard } from "../db/ptWizard.ts";
import { montarMapaEmojis } from "../domain/emoji.ts";
import { HandlerResult } from "./context.ts";
import { montarPayloadPasso2, montarPayloadPasso3Selecao } from "./ui.ts";

const SESSAO_EXPIRADA = "⚠️ Sessão expirada — use /conteudo de novo pra começar.";

export function handleBotaoPasso2(
  interaction: DiscordInteraction,
  customId: "tier_true" | "tier_false" | "skip_true" | "skip_false",
): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }

      if (customId === "tier_true") dados.temTier = true;
      if (customId === "tier_false") {
        dados.temTier = false;
        dados.tier = "Livre";
      }
      if (customId === "skip_true") dados.precisaSkip = true;
      if (customId === "skip_false") dados.precisaSkip = false;

      await salvarEstadoWizard(liderId, dados);
      await editarRespostaOriginal(applicationId, token, montarPayloadPasso2(dados));
    },
  };
}

export function handleSelectTierEspecifico(interaction: DiscordInteraction): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const valor = interaction.data?.values?.[0];
  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }

      dados.tier = valor ?? dados.tier;
      await salvarEstadoWizard(liderId, dados);
      await editarRespostaOriginal(applicationId, token, montarPayloadPasso2(dados));
    },
  };
}

export function handleBtnPasso3(interaction: DiscordInteraction): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const guildId = interaction.guild_id;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }

      const emojisGuilda = guildId ? await buscarEmojisDaGuilda(guildId) : [];
      const mapaEmojis = montarMapaEmojis(emojisGuilda);
      await editarRespostaOriginal(applicationId, token, montarPayloadPasso3Selecao(dados, mapaEmojis));
    },
  };
}
