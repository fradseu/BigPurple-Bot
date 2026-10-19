// formulario.ts - As duas telas do "Ficar disponível" (só a pessoa vê):
//   1. ESCOLHER: áreas, atividades (as das áreas escolhidas), classes e tier.
//   2. REVISAR:  resumo + duração (botões) + Confirmar.
// Separado em duas porque o Discord só aceita 5 linhas de componentes por mensagem.
import {
  AREAS,
  atividadesDasAreas,
  CLASSES,
  COR_ROXO,
  DURACOES_MIN,
  MAX_ATIVIDADES,
  MAX_CLASSES,
  TIERS,
} from "../config.ts";
import {
  actionRow,
  ActionRowComponent,
  ButtonComponent,
  ButtonStyle,
  ComponentType,
  DiscordEmbed,
  SelectOption,
  StringSelectComponent,
} from "../discord/types.ts";
import { EstadoWizard, itensFaltando, wizardCompleto } from "../domain/wizard.ts";

interface Tela {
  content: string;
  embeds: DiscordEmbed[];
  components: ActionRowComponent[];
}

function lista(
  customId: string,
  placeholder: string,
  opcoes: Array<{ label: string; value: string; emoji?: string }>,
  selecionados: string[],
  max: number,
): StringSelectComponent {
  const options: SelectOption[] = opcoes.map((o) => ({
    label: o.label,
    value: o.value,
    default: selecionados.includes(o.value),
    ...(o.emoji ? { emoji: { name: o.emoji } } : {}),
  }));
  return {
    type: ComponentType.StringSelect,
    custom_id: customId,
    placeholder,
    options,
    min_values: 1,
    max_values: Math.min(max, options.length),
  };
}

const rotulo = (valores: string[], rotulos: Map<string, string>) =>
  valores.map((v) => rotulos.get(v) ?? v).join(", ") || "—";

// Tela 1: escolher.
export function montarFormulario(estado: EstadoWizard, aviso?: string): Tela {
  // "Duração" tem valor padrão, então não conta como pendência nesta tela.
  const faltando = itensFaltando(estado).filter((i) => i !== "duração");
  const status = faltando.length > 0
    ? `⏳ Falta escolher: **${faltando.join(", ")}**.`
    : `✅ Tudo certo — clique em **Revisar**.`;

  const embed: DiscordEmbed = {
    title: "🙋 Ficar disponível",
    description:
      `Escolha onde e o que você quer jogar. Os líderes veem só **área, atividade, classe e tier** — nunca o seu nick.\n\n` +
      `${status}${aviso ? `\n\n${aviso}` : ""}`,
    color: COR_ROXO,
  };

  return {
    content: "",
    embeds: [embed],
    components: [
      actionRow(
        lista(
          "pool_sel:areas",
          "Em quais áreas? (PVE, PVP, Facção, Avalon)",
          AREAS.map((a) => ({ label: a.label, value: a.value, emoji: a.emoji })),
          estado.areas,
          AREAS.length,
        ),
      ),
      actionRow(
        lista(
          "pool_sel:atividades",
          `Atividades (até ${MAX_ATIVIDADES})`,
          atividadesDasAreas(estado.areas),
          estado.atividades,
          MAX_ATIVIDADES,
        ),
      ),
      actionRow(
        lista(
          "pool_sel:classes",
          `Classe / papel (até ${MAX_CLASSES})`,
          CLASSES.map((c) => ({ label: c, value: c })),
          estado.classes,
          MAX_CLASSES,
        ),
      ),
      actionRow(
        lista("pool_sel:tier", "Seu tier", TIERS.map((t) => ({ label: t, value: t })), estado.tier ? [estado.tier] : [], 1),
      ),
      actionRow(
        {
          type: ComponentType.Button,
          style: ButtonStyle.Primary,
          label: "Revisar",
          emoji: { name: "▶️" },
          custom_id: "pool_revisar",
          disabled: faltando.length > 0,
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Secondary,
          label: "Cancelar",
          custom_id: "pool_cancelar",
        },
      ),
    ],
  };
}

// Tela 2: revisar + duração + confirmar.
export function montarRevisao(estado: EstadoWizard, aviso?: string): Tela {
  const areaPorValor = new Map(AREAS.map((a) => [a.value, `${a.emoji} ${a.label}`]));
  const atividadePorValor = new Map(atividadesDasAreas([]).map((a) => [a.value, a.label]));

  const embed: DiscordEmbed = {
    title: "📋 Confirme sua disponibilidade",
    description:
      `🧭 **Áreas:** ${rotulo(estado.areas, areaPorValor)}\n` +
      `🎯 **Atividades:** ${rotulo(estado.atividades, atividadePorValor)}\n` +
      `🛡️ **Classes:** ${estado.classes.join(", ") || "—"}\n` +
      `🏷️ **Tier:** ${estado.tier ?? "—"}\n\n` +
      `⏱️ **Por quanto tempo você fica disponível?** Depois disso você sai da lista sozinho — ` +
      `e pode sair antes quando quiser.${aviso ? `\n\n${aviso}` : ""}`,
    color: COR_ROXO,
  };

  const botoesDuracao: ButtonComponent[] = DURACOES_MIN.map((d) => ({
    type: ComponentType.Button,
    style: estado.duracaoMin === d.minutos ? ButtonStyle.Success : ButtonStyle.Secondary,
    label: d.label,
    custom_id: `pool_dur:${d.minutos}`,
  }));

  return {
    content: "",
    embeds: [embed],
    components: [
      actionRow(...botoesDuracao),
      actionRow(
        {
          type: ComponentType.Button,
          style: ButtonStyle.Secondary,
          label: "Voltar",
          emoji: { name: "◀️" },
          custom_id: "pool_voltar",
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Success,
          label: "Confirmar",
          emoji: { name: "✅" },
          custom_id: "pool_confirmar",
          disabled: !wizardCompleto(estado),
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Secondary,
          label: "Cancelar",
          custom_id: "pool_cancelar",
        },
      ),
    ],
  };
}
