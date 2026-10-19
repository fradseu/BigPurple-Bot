// controle.ts - A mensagem de controle fixa dentro da caixa privada de cada pessoa:
// mostra a situação (disponível ou não) e os botões. Pura (só monta dados).
import { COR_CINZA, COR_VERDE } from "../config.ts";
import {
  actionRow,
  ActionRowComponent,
  ButtonStyle,
  ComponentType,
  DiscordEmbed,
} from "../discord/types.ts";

export interface DisponibilidadeResumo {
  areas: string[];
  atividades: string[];
  classes: string[];
  tier: string;
  expiraEm: number; // epoch ms
}

const timestamp = (ms: number, estilo: "t" | "R") => `<t:${Math.floor(ms / 1000)}:${estilo}>`;

export function montarControle(
  disponibilidade: DisponibilidadeResumo | null,
  agora: number,
): { embed: DiscordEmbed; components: ActionRowComponent[] } {
  const disponivel = disponibilidade !== null && disponibilidade.expiraEm > agora;

  const situacao = disponivel
    ? `🟢 **Disponível** até ${timestamp(disponibilidade.expiraEm, "t")} (${timestamp(disponibilidade.expiraEm, "R")})\n` +
      `🧭 **Áreas:** ${disponibilidade.areas.join(", ") || "—"}\n` +
      `🎯 **Atividades:** ${disponibilidade.atividades.join(", ")}\n` +
      `🛡️ **Classes:** ${disponibilidade.classes.join(", ")}\n` +
      `🏷️ **Tier:** ${disponibilidade.tier}`
    : `⚪ **Você não está na lista.**\nClique em **Ficar disponível** pra aparecer no catálogo dos líderes.`;

  const embed: DiscordEmbed = {
    title: "📬 Sua caixa de convites",
    description: `${situacao}\n\n` +
      `Os convites chegam **aqui**, só pra você, e somem em poucos minutos. ` +
      `Os líderes veem só a **classe** e o **tier** que você escolheu — sem nome, sem nick e sem nenhum ` +
      `código seu. Seu nick só aparece pra quem você aceitar.`,
    color: disponivel ? COR_VERDE : COR_CINZA,
  };

  const components: ActionRowComponent[] = [
    actionRow(
      {
        type: ComponentType.Button,
        style: ButtonStyle.Primary,
        label: disponivel ? "Alterar" : "Ficar disponível",
        emoji: { name: "🙋" },
        custom_id: "pool_ficar",
      },
      {
        type: ComponentType.Button,
        style: ButtonStyle.Danger,
        label: "Sair da lista",
        emoji: { name: "🚪" },
        custom_id: "pool_sair",
        disabled: !disponivel,
      },
    ),
  ];

  return { embed, components };
}
