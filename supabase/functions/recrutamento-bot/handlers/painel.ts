// painel.ts - Comando /recrutamento-painel: posta (no canal onde foi usado) a
// mensagem fixa com o botão "Solicitar ingresso". Só admin do servidor.
import { NOME_GUILDA } from "../config.ts";
import { ehAdminDoServidor } from "../discord/membro.ts";
import { reply } from "../discord/responses.ts";
import {
  actionRow,
  ButtonStyle,
  ComponentType,
  DiscordEmbed,
  DiscordInteraction,
} from "../discord/types.ts";
import { HandlerResult } from "./context.ts";

export function handlePainel(interaction: DiscordInteraction): HandlerResult {
  if (!ehAdminDoServidor(interaction)) {
    return {
      immediate: reply("❌ Só quem tem **Gerenciar Servidor** pode postar o painel de recrutamento.", {
        ephemeral: true,
      }),
    };
  }

  const embed: DiscordEmbed = {
    title: "🟣 COMO SER RECRUTADO?",
    description:
      `Quer entrar na **${NOME_GUILDA}**?\n\n` +
      `Clique no botão abaixo e preencha:\n` +
      `• **Nickname** (exatamente como é no jogo)\n` +
      `• **Fama total**\n` +
      `• **Como conheceu a guilda**\n\n` +
      `Um recrutador vai analisar sua candidatura e te dar o retorno.`,
    color: 0x7b2cbf,
  };

  return {
    immediate: reply("", {
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
    }),
  };
}
