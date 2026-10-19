// membro.ts - Leitura de quem fez a interação: nome, cargos e permissões.
import { CARGO_RECRUTADOR_ID } from "../config.ts";
import { DiscordInteraction } from "./types.ts";

const PERMISSAO_ADMINISTRADOR = 1n << 3n;
const PERMISSAO_GERENCIAR_SERVIDOR = 1n << 5n;

export function nomeExibicao(interaction: DiscordInteraction): string {
  const user = interaction.member?.user ?? interaction.user;
  return interaction.member?.nick ?? user?.global_name ?? user?.username ?? "alguém";
}

// "Gerenciar Servidor" ou Administrador. BigInt porque o bitfield de
// permissões do Discord passa de 53 bits (não cabe em number com segurança).
export function ehAdminDoServidor(interaction: DiscordInteraction): boolean {
  const bruto = interaction.member?.permissions;
  if (!bruto) return false;
  const perms = BigInt(bruto);
  return (perms & (PERMISSAO_ADMINISTRADOR | PERMISSAO_GERENCIAR_SERVIDOR)) !== 0n;
}

export function ehRecrutador(interaction: DiscordInteraction): boolean {
  if (ehAdminDoServidor(interaction)) return true;
  if (!CARGO_RECRUTADOR_ID) return false;
  return interaction.member?.roles?.includes(CARGO_RECRUTADOR_ID) ?? false;
}
