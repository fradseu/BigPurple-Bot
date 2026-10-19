// ui.ts - Builders de tela compartilhados entre handlers (equivalente às
// funções auxiliares soltas no fim do index.js do v1: montarPayloadPasso1,
// montarBotoesBonus, atualizarComponentesPainel, renderizarPasso2/3).

import { ATIVIDADES, BONUS, CIDADES, FUNCOES, ZONAS } from "../config.ts";
import { buscarMembro, nomeExibicaoMembro } from "../discord/rest.ts";
import {
  ActionRowComponent,
  ButtonComponent,
  ButtonStyle,
  InteractionCallbackData,
  SelectOption,
  TextInputStyle,
  actionRow,
} from "../discord/types.ts";
import { DadosWizard } from "../db/ptWizard.ts";
import {
  EmojiResolvido,
  compararClasses,
  emojiParaComponente,
  parseClasseComEmoji,
} from "../domain/emoji.ts";
import { MARCADOR_SALA_VOZ, listarJogadoresInscritos } from "../domain/vagas.ts";
import { ID_ABRIR_CATALOGO } from "../domain/catalogo.ts";

// `selecionados` marca quais opções já foram escolhidas antes — sem isso,
// toda vez que a mensagem é redesenhada (ex: depois do modal de título), os
// dropdowns aparecem visualmente "resetados" mesmo com o dado intacto no
// banco, porque o Discord não lembra sozinho qual opção estava marcada numa
// troca de conteúdo inteira da mensagem.
function opcoesParaSelect(
  opcoes: { label: string; value: string }[],
  selecionados: string[] = [],
): SelectOption[] {
  return opcoes.map((o) => ({
    label: o.label,
    value: o.value,
    default: selecionados.includes(o.value),
  }));
}

// ---------------------------------------------------------------------------
// PASSO 1
// ---------------------------------------------------------------------------
export function montarPayloadPasso1(dados: DadosWizard): InteractionCallbackData {
  const menuAtividades = {
    type: 3 as const,
    custom_id: "config_atividade",
    placeholder: "⚔️ Selecione as atividades (Multi-select)",
    min_values: 1,
    max_values: 4,
    options: opcoesParaSelect(ATIVIDADES, dados.atividades),
  };

  const menuCidades = {
    type: 3 as const,
    custom_id: "config_cidade",
    placeholder: "📍 Selecione a Cidade de Encontro",
    options: opcoesParaSelect(CIDADES, dados.cidade ? [dados.cidade] : []),
  };

  const menuZonas = {
    type: 3 as const,
    custom_id: "config_zona",
    placeholder: "🗺️ Selecione o Tipo de Zona (Amarela/Red/Black)",
    options: opcoesParaSelect(ZONAS, dados.zona ? [dados.zona] : []),
  };

  const temDetalhes = dados.titulo || dados.data || dados.hora;
  const botaoTitulo = {
    type: 2 as const,
    style: ButtonStyle.Secondary,
    custom_id: "btn_definir_titulo",
    label: temDetalhes ? "✏️ Editar Título/Data/Hora" : "✏️ Definir Título/Data/Hora (Opcional)",
  };

  const botaoAvancar = {
    type: 2 as const,
    style: ButtonStyle.Success,
    custom_id: "btn_passo2",
    label: "Avançar para Requisitos ➡️",
  };

  const tituloExibido = dados.titulo
    ? `**${dados.titulo}**`
    : "*(usando o título padrão 🔱 PROMPT DE CONTEÚDO)*";
  const dataHoraExibida =
    dados.data || dados.hora
      ? `${dados.data || "(sem data)"} às ${dados.hora || "(sem hora)"}`
      : "*(não definida)*";

  return {
    content:
      `🛠️ **PASSO 1: Configuração Inicial**\n` +
      `📌 Título: ${tituloExibido}\n` +
      `🗓️ Data/Hora: ${dataHoraExibida}\n\n` +
      `Defina os parâmetros do conteúdo usando os menus abaixo e clique em Avançar:`,
    components: [
      actionRow(botaoTitulo),
      actionRow(menuAtividades),
      actionRow(menuCidades),
      actionRow(menuZonas),
      actionRow(botaoAvancar),
    ],
  };
}

export function montarModalTitulo(dados: DadosWizard) {
  return {
    customId: "modal_titulo",
    title: "Título / Data / Hora da PT",
    components: [
      actionRow({
        type: 4 as const,
        custom_id: "input_titulo",
        style: TextInputStyle.Short,
        label: "Título da PT (opcional)",
        placeholder: "Ex: FIXA P/ RECÉM-CHEGADOS (APENAS RECÉM-CHEGADOS)",
        max_length: 150,
        required: false,
        value: dados.titulo || undefined,
      }),
      actionRow({
        type: 4 as const,
        custom_id: "input_data",
        style: TextInputStyle.Short,
        label: "Data (opcional)",
        placeholder: "Ex: 04/08/2026",
        max_length: 20,
        required: false,
        value: dados.data || undefined,
      }),
      actionRow({
        type: 4 as const,
        custom_id: "input_hora",
        style: TextInputStyle.Short,
        label: "Horário (opcional)",
        placeholder: "Ex: 20:30",
        max_length: 10,
        required: false,
        value: dados.hora || undefined,
      }),
    ],
  };
}

// ---------------------------------------------------------------------------
// PASSO 2
// ---------------------------------------------------------------------------
const TIERS_ESPECIFICOS = [
  "T4.1 Equivalente",
  "T4.2 Equivalente",
  "T4.3 Equivalente",
  "T5.0 Equivalente",
  "T6.0 Equivalente",
  "T7.0 Equivalente",
  "T8.0 Equivalente",
];

export function montarPayloadPasso2(dados: DadosWizard): InteractionCallbackData {
  const rowBotoesTier = actionRow(
    {
      type: 2 as const,
      custom_id: "tier_true",
      label: "Com limite de Tier",
      style: dados.temTier === true ? ButtonStyle.Primary : ButtonStyle.Secondary,
    },
    {
      type: 2 as const,
      custom_id: "tier_false",
      label: "Tier Livre",
      style: dados.temTier === false ? ButtonStyle.Primary : ButtonStyle.Secondary,
    },
  );

  const rows: ActionRowComponent[] = [rowBotoesTier];

  if (dados.temTier === true) {
    rows.push(
      actionRow({
        type: 3 as const,
        custom_id: "select_tier_especifico",
        placeholder: "📊 Selecione o Tier",
        options: TIERS_ESPECIFICOS.map((t) => ({ label: t, value: t })),
      }),
    );
  }

  rows.push(
    actionRow(
      {
        type: 2 as const,
        custom_id: "skip_true",
        label: "Precisa Set Skip (T4)",
        style: dados.precisaSkip === true ? ButtonStyle.Danger : ButtonStyle.Secondary,
      },
      {
        type: 2 as const,
        custom_id: "skip_false",
        label: "Não precisa de Skip",
        style: dados.precisaSkip === false ? ButtonStyle.Success : ButtonStyle.Secondary,
      },
    ),
  );

  const pronto = dados.temTier !== null && dados.precisaSkip !== null;

  rows.push(
    actionRow({
      type: 2 as const,
      custom_id: "btn_passo3",
      label: "Avançar para Montar a PT ➡️",
      style: ButtonStyle.Success,
      disabled: !pronto,
    }),
  );

  const setSkipTexto =
    dados.precisaSkip === null ? "Pendente" : dados.precisaSkip ? "Obrigatório T4+" : "Dispensado";

  return {
    content:
      `🛠 **PASSO 2: Requisitos de Entrada**\n` +
      `• Tier Mínimo: **${dados.tier}**\n` +
      `• Set de Skip: **${setSkipTexto}**`,
    components: rows,
  };
}

// ---------------------------------------------------------------------------
// PASSO 3
// ---------------------------------------------------------------------------
export function montarPayloadPasso3Selecao(
  emojisResolvidos: Map<string, EmojiResolvido>,
): InteractionCallbackData {
  const opcoes: SelectOption[] = [...FUNCOES].sort(compararClasses).slice(0, 25).map((classe) => {
    const { nome, emoji } = parseClasseComEmoji(classe, emojisResolvidos);
    return { label: nome, value: classe, emoji: emojiParaComponente(emoji) };
  });

  return {
    content:
      `🛠️ **PASSO 3: Seleção de Composição da PT**\n` +
      `Escolha no menu abaixo **quais classes** farão parte deste conteúdo (Máximo de 25 exibidas):`,
    components: [
      actionRow({
        type: 3 as const,
        custom_id: "selecionar_classes_da_pt",
        placeholder: "🧙‍♂️ Quais classes terão vagas nesta PT?",
        min_values: 1,
        max_values: opcoes.length,
        options: opcoes,
      }),
    ],
  };
}

export function montarPayloadPasso3Painel(
  dados: DadosWizard,
  emojisResolvidos: Map<string, EmojiResolvido>,
): InteractionCallbackData {
  const classesAtivas = dados.classesAtivas ?? [];
  const classeFocada =
    dados.classeFocada && classesAtivas.includes(dados.classeFocada)
      ? dados.classeFocada
      : classesAtivas[0];

  const { nome: nomeClasseFocoTexto } = parseClasseComEmoji(classeFocada, emojisResolvidos);

  // Dropdown único pra escolher qual classe focar, em vez de um botão por
  // classe: com muitas classes selecionadas (o Discord só aceita 25 no
  // máximo), um botão por classe estourava fácil o limite de 5 linhas de
  // componentes por mensagem. Um select cabe até 25 opções numa linha só.
  const linhasBotoes: ActionRowComponent[] = [];

  const opcoesFoco: SelectOption[] = [...classesAtivas].sort(compararClasses).map((classe) => {
    const qtd = dados.funcoes[classe] ?? 1;
    const { nome, emoji } = parseClasseComEmoji(classe, emojisResolvidos);
    return {
      label: nome,
      value: classe,
      description: `Vagas atuais: ${qtd}`,
      emoji: emojiParaComponente(emoji),
      default: classe === classeFocada,
    };
  });

  linhasBotoes.push(
    actionRow({
      type: 3 as const,
      custom_id: "focar_classe_select",
      placeholder: "🎯 Escolha a classe pra ajustar a quantidade",
      options: opcoesFoco,
    }),
  );

  const qtdAtualFoco = dados.funcoes[classeFocada] ?? 1;

  linhasBotoes.push(
    actionRow(
      {
        type: 2 as const,
        custom_id: "painel_rem_1",
        label: `➖ Diminuir ${nomeClasseFocoTexto}`,
        style: ButtonStyle.Danger,
        disabled: qtdAtualFoco <= 0,
      },
      {
        type: 2 as const,
        custom_id: "painel_add_1",
        label: `➕ Aumentar ${nomeClasseFocoTexto}`,
        style: ButtonStyle.Success,
      },
    ),
  );

  linhasBotoes.push(
    actionRow(
      {
        type: 2 as const,
        custom_id: "btn_voltar_classes",
        label: "🔄 Mudar Classes",
        style: ButtonStyle.Secondary,
      },
      {
        type: 2 as const,
        custom_id: "btn_gerar_painel_final",
        label: "🚀 GERAR PAINEL FINAL",
        style: ButtonStyle.Success,
      },
    ),
  );

  return {
    content:
      `🛠️ **PASSO 3: Painel de Vagas da PT**\n` +
      `Selecione a classe nos botões abaixo para ver os controles de ajuste individual:\n\n` +
      `➡️ **Modificando agora:** ${parseClasseComEmoji(classeFocada, emojisResolvidos).nome}\n`,
    components: linhasBotoes,
  };
}

// ---------------------------------------------------------------------------
// PAINEL PÚBLICO (bônus + reconstrução de componentes após inscrição/kick)
// ---------------------------------------------------------------------------
export function montarBotoesBonus(): ActionRowComponent {
  return actionRow(
    ...BONUS.map((b) => ({
      type: 2 as const,
      custom_id: `bonus_${b.value}`,
      label: b.label,
      style: ButtonStyle.Secondary,
      emoji: { name: b.emoji },
    })),
  );
}

// Reconstrói os componentes do painel público (dropdown de inscrição + Sair da
// PT + bônus + dropdown secreto de kick) depois de qualquer alteração nas
// linhas de vaga. `opcoesClasse` vem direto do snapshot da própria interação
// (interaction.message.components[0].components[0].options), igual o v1 fazia.
// `linhasVagas` vem da description do Embed; `conteudoAtual` é o content da
// mensagem (onde vive a linha de Sala de Voz).
export async function atualizarComponentesPainel(
  linhasVagas: string[],
  conteudoAtual: string,
  opcoesClasse: SelectOption[],
  guildId: string | undefined,
): Promise<ActionRowComponent[]> {
  const componentes: ActionRowComponent[] = [];

  componentes.push(
    actionRow({
      type: 3 as const,
      custom_id: "vaga_publica_inscrever",
      placeholder: "Selecione sua classe para entrar nesta PT",
      options: opcoesClasse,
    }),
  );

  const linhaSalaDeVoz = conteudoAtual
    .split("\n")
    .find((linha) => linha.startsWith(MARCADOR_SALA_VOZ));
  const canalVozId = linhaSalaDeVoz?.match(/<#(\d+)>/)?.[1];
  const temSalaDeVoz = Boolean(canalVozId);

  // Essa linha (Sair da PT + Sala de Voz [+ Entrar, se existir]) vai por
  // ÚLTIMA — só monta agora, empurra pro final da lista de componentes.
  const botoesDesistirESala: ButtonComponent[] = [
    {
      type: 2 as const,
      custom_id: "vaga_publica_desistir",
      label: "❌ Sair da PT",
      style: ButtonStyle.Danger,
    },
    {
      type: 2 as const,
      custom_id: "sala_voz_toggle",
      label: temSalaDeVoz ? "🔒 Fechar Sala de Voz" : "🔊 Criar Sala de Voz",
      style: temSalaDeVoz ? ButtonStyle.Secondary : ButtonStyle.Primary,
    },
    // Catálogo anônimo do Pool (só o líder usa; o handler valida).
    {
      type: 2 as const,
      custom_id: ID_ABRIR_CATALOGO,
      label: "👥 Ver disponíveis",
      style: ButtonStyle.Secondary,
    },
  ];

  // Botão de link direto pro canal de voz — só aparece quando a sala existe.
  // Botões de link não disparam interação nenhuma, o Discord navega sozinho.
  if (temSalaDeVoz && canalVozId && guildId) {
    botoesDesistirESala.push({
      type: 2 as const,
      label: "🎧 Entrar na Sala",
      style: ButtonStyle.Link,
      url: `https://discord.com/channels/${guildId}/${canalVozId}`,
    });
  }

  const rowDesistirESala = actionRow(...botoesDesistirESala);

  componentes.push(montarBotoesBonus());

  const jogadores = listarJogadoresInscritos(linhasVagas);

  if (jogadores.length > 0) {
    const opcoesKick: SelectOption[] = [];
    for (const { mention, cargo } of jogadores) {
      const idBruto = mention.replace(/[<@>]/g, "");
      let nomeExibicao = idBruto;

      if (guildId) {
        const membro = await buscarMembro(guildId, idBruto);
        nomeExibicao = nomeExibicaoMembro(membro, idBruto);
      }

      const rotulo = cargo ? `${nomeExibicao} — ${cargo}` : nomeExibicao;
      opcoesKick.push({ label: rotulo.slice(0, 100), value: mention });
    }

    componentes.push(
      actionRow({
        type: 3 as const,
        custom_id: "vaga_publica_kickar",
        placeholder: "⚙️ Gerenciar PT: Kickar jogador (Apenas Líder)",
        options: opcoesKick,
      }),
    );
  }

  componentes.push(rowDesistirESala);

  return componentes;
}
