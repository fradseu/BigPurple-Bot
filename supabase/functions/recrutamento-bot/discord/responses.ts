// responses.ts - Helpers pra montar o JSON de resposta de uma interação do Discord.
// Cada função aqui corresponde a um dos "jeitos de responder" que existiam como
// métodos do discord.js (interaction.reply, deferUpdate, update, showModal...).

import {
  ActionRowComponent,
  DiscordEmbed,
  InteractionResponse,
  InteractionResponseType,
  MESSAGE_FLAG_EPHEMERAL,
} from "./types.ts";

export function pong(): InteractionResponse {
  return { type: InteractionResponseType.Pong };
}

// Resposta imediata com texto (equivalente a interaction.reply)
export function reply(
  content: string,
  options: { ephemeral?: boolean; components?: ActionRowComponent[]; embeds?: DiscordEmbed[] } = {},
): InteractionResponse {
  return {
    type: InteractionResponseType.ChannelMessageWithSource,
    data: {
      content,
      components: options.components,
      embeds: options.embeds,
      flags: options.ephemeral ? MESSAGE_FLAG_EPHEMERAL : undefined,
    },
  };
}

// Avisa "processando" numa nova mensagem (equivalente a deferReply). O conteúdo
// final vem depois via followUp/editOriginal no rest.ts.
export function deferredReply(ephemeral = false): InteractionResponse {
  return {
    type: InteractionResponseType.DeferredChannelMessageWithSource,
    data: ephemeral ? { flags: MESSAGE_FLAG_EPHEMERAL } : undefined,
  };
}

// Avisa "processando" SEM criar mensagem nova, mantendo a mensagem original
// como está até a gente editar depois via rest.ts (equivalente a deferUpdate()).
export function deferredUpdate(): InteractionResponse {
  return { type: InteractionResponseType.DeferredUpdateMessage };
}

// Edita a própria mensagem que tinha o componente clicado, na hora
// (equivalente a interaction.update({...})).
export function updateMessage(
  content: string,
  components: ActionRowComponent[] = [],
  embeds?: DiscordEmbed[],
): InteractionResponse {
  return {
    type: InteractionResponseType.UpdateMessage,
    data: { content, components, embeds },
  };
}

// Abre um modal (equivalente a interaction.showModal(...))
export function showModal(
  customId: string,
  title: string,
  components: ActionRowComponent[],
): InteractionResponse {
  return {
    type: InteractionResponseType.Modal,
    data: { custom_id: customId, title, components },
  };
}
