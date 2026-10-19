// formulario.ts - Monta a tela "Ficar disponível": 4 listas (atividade, classe,
// tier, duração) + Confirmar/Cancelar numa mensagem só que só a pessoa vê.
import {
  ATIVIDADES,
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
  ButtonStyle,
  ComponentType,
  DiscordEmbed,
  SelectOption,
  StringSelectComponent,
} from "../discord/types.ts";
import { EstadoWizard, itensFaltando, wizardCompleto } from "../domain/wizard.ts";

function lista(
  customId: string,
  placeholder: string,
  opcoes: Array<{ label: string; value: string }>,
  selecionados: string[],
  max: number,
): StringSelectComponent {
  const options: SelectOption[] = opcoes.map((o) => ({
    label: o.label,
    value: o.value,
    default: selecionados.includes(o.value),
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

export function montarFormulario(
  estado: EstadoWizard,
  aviso?: string,
): { content: string; embeds: DiscordEmbed[]; components: ActionRowComponent[] } {
  const faltando = itensFaltando(estado);
  const status = faltando.length > 0
    ? `⏳ Falta escolher: **${faltando.join(", ")}**.`
    : `✅ Tudo certo — é só confirmar.`;

  const embed: DiscordEmbed = {
    title: "🙋 Ficar disponível",
    description:
      `Escolha o que você quer jogar. Os líderes veem só **atividade, classe e tier** — nunca o seu nick.\n\n` +
      `${status}${aviso ? `\n\n${aviso}` : ""}`,
    color: COR_ROXO,
  };

  return {
    content: "",
    embeds: [embed],
    components: [
      actionRow(
        lista(
          "pool_sel:atividades",
          `Atividades (até ${MAX_ATIVIDADES})`,
          ATIVIDADES,
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
        lista(
          "pool_sel:duracao",
          "Por quanto tempo?",
          DURACOES_MIN.map((d) => ({ label: d.label, value: String(d.minutos) })),
          estado.duracaoMin ? [String(estado.duracaoMin)] : [],
          1,
        ),
      ),
      actionRow(
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
