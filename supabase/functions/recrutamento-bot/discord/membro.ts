// membro.ts - Lê de uma interação quem está agindo (nome e contexto de permissões).
// As REGRAS de permissão ficam em domain/permissoes.ts (puras e testadas).
import { ContextoMembro } from "../domain/permissoes.ts";
import { DiscordInteraction, getInteractionUserId } from "./types.ts";

export function nomeExibicao(interaction: DiscordInteraction): string {
  const user = interaction.member?.user ?? interaction.user;
  return interaction.member?.nick ?? user?.global_name ?? user?.username ?? "alguém";
}

export function contextoDoMembro(interaction: DiscordInteraction): ContextoMembro {
  return {
    userId: getInteractionUserId(interaction),
    roles: interaction.member?.roles ?? [],
    permissoes: interaction.member?.permissions,
  };
}
