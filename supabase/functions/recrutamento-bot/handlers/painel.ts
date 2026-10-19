// painel.ts - Comando /recrutamento-painel: posta (no canal onde foi usado) a
// mensagem fixa com o botão "Solicitar ingresso". Só administrador ou
// autorizado (veja /recrutamento-config). A resposta de quem usou é privada
// ("pensando..." -> "painel postado"); o painel em si é uma mensagem pública
// enviada pelo bot.
import { NOME_GUILDA } from "../config.ts";
import { obterConfig, permissoesDe } from "../db/config.ts";
import { contextoDoMembro } from "../discord/membro.ts";
import { deferredReply } from "../discord/responses.ts";
import { editarRespostaOriginal, enviarMensagem } from "../discord/rest.ts";
import {
  actionRow,
  ButtonStyle,
  ComponentType,
  DiscordEmbed,
  DiscordInteraction,
} from "../discord/types.ts";
import { podeConfigurar } from "../domain/permissoes.ts";
import { HandlerResult } from "./context.ts";

export function handlePainel(interaction: DiscordInteraction): HandlerResult {
  const guildId = interaction.guild_id;
  const canalId = interaction.channel_id;
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const ctx = contextoDoMembro(interaction);

  return {
    immediate: deferredReply(true),
    background: async () => {
      const responder = (content: string) =>
        editarRespostaOriginal(applicationId, token, { content, allowed_mentions: { parse: [] } });

      if (!guildId || !canalId) {
        await responder("⚠️ Esse comando só funciona dentro de um servidor.");
        return;
      }

      const config = await obterConfig(guildId);
      if (!podeConfigurar(ctx, permissoesDe(config))) {
        await responder(
          "❌ Só **administradores** do servidor (ou pessoas autorizadas por eles) podem postar o painel.",
        );
        return;
      }

      const embed: DiscordEmbed = {
        title: "🟣 COMO SER RECRUTADO?",
        description: `Quer entrar na **${NOME_GUILDA}**?\n\n` +
          `Clique no botão abaixo e preencha:\n` +
          `• **Nickname** (exatamente como é no jogo)\n` +
          `• **Fama total**\n` +
          `• **Como conheceu a guilda**\n\n` +
          `Um recrutador vai analisar sua candidatura e te dar o retorno.\n\n` +
          `ℹ️ Se for aprovado, você recebe o cargo **Membro** e seu apelido aqui no servidor passa a ser ` +
          `o seu **nick do jogo** — fixo, só o dono do servidor altera.`,
        color: 0x7b2cbf,
      };

      await enviarMensagem(canalId, {
        embeds: [embed],
        components: [
          actionRow({
            type: ComponentType.Button,
            style: ButtonStyle.Primary,
            label: "Solicitar ingresso",
            emoji: { name: "📝" },
            custom_id: "rec_abrir_form",
          }),
        ],
      });

      const aviso = config?.canal_recrutadores_id
        ? ""
        : `\n⚠️ O canal dos recrutadores ainda não foi definido — use \`/recrutamento-config canal\` antes de abrir as inscrições.`;
      await responder(`✅ Painel postado em <#${canalId}>.${aviso}`);
    },
  };
}
