// painel.ts - Comando /pool-painel (só administrador): posta no canal atual o
// painel com o botão "Ficar disponível" e marca ESSE canal como o Pool de conteúdo
// (é nele que as caixas privadas — tópicos — vão ser criadas).
import { COR_ROXO } from "../config.ts";
import { definirCanalPool } from "../db/pool.ts";
import { deferredReply } from "../discord/responses.ts";
import { editarRespostaOriginal, enviarMensagem } from "../discord/rest.ts";
import {
  actionRow,
  ButtonStyle,
  ComponentType,
  DiscordEmbed,
  DiscordInteraction,
} from "../discord/types.ts";
import { ehAdministrador } from "../domain/permissoes.ts";
import { HandlerResult } from "./context.ts";

export function handlePainel(interaction: DiscordInteraction): HandlerResult {
  const guildId = interaction.guild_id;
  const canalId = interaction.channel_id;
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const admin = ehAdministrador(interaction.member?.permissions);

  return {
    immediate: deferredReply(true),
    background: async () => {
      const responder = (content: string) =>
        editarRespostaOriginal(applicationId, token, { content, allowed_mentions: { parse: [] } });

      if (!guildId || !canalId) return await responder("⚠️ Esse comando só funciona dentro de um servidor.");
      if (!admin) return await responder("❌ Só **administradores** do servidor podem postar o painel do pool.");

      const embed: DiscordEmbed = {
        title: "🎯 Pool de conteúdo",
        description:
          `Quer jogar mas ainda não tem grupo? **Fique disponível** e os líderes montam a PT com você.\n\n` +
          `• Você escolhe **atividade, classe e tier**\n` +
          `• Os líderes **não veem o seu nick**\n` +
          `• O convite chega numa **caixa privada só sua** — você aceita ou recusa sem ninguém saber quem recusou\n` +
          `• Você sai da lista quando quiser`,
        color: COR_ROXO,
      };

      await enviarMensagem(canalId, {
        embeds: [embed],
        components: [
          actionRow({
            type: ComponentType.Button,
            style: ButtonStyle.Primary,
            label: "Ficar disponível",
            emoji: { name: "🙋" },
            custom_id: "pool_ficar",
          }),
        ],
      });
      await definirCanalPool(guildId, canalId);

      await responder(
        `✅ Painel postado e <#${canalId}> definido como **Pool de conteúdo**.\n` +
          `Pra a caixa de cada pessoa ficar só de leitura, desligue **"Enviar mensagens em tópicos"** do @everyone ` +
          `neste canal (o bot precisa continuar com essa permissão).`,
      );
    },
  };
}
