// ui.ts - Builders de tela compartilhados entre handlers (equivalente às
// funções auxiliares soltas no fim do index.js do v1: montarPayloadPasso1,
// montarBotoesBonus, atualizarComponentesPainel, renderizarPasso2/3).

import { BONUS, ROLES_PAINEL, TIPOS_CONTEUDO } from "../config.ts";
import { PingSalvo } from "../db/pings.ts";
import { ARVORES, classeDaArma, classeGenericaDaArvore } from "../../_shared/armas.ts";
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
  formatarClasseParaMensagem,
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
export function rotuloTipo(tipo: string | undefined): string {
  const t = TIPOS_CONTEUDO.find((x) => x.value === tipo);
  return t ? `${t.emoji} ${t.label}` : "";
}

// Resumo do que já foi definido (usado no topo das telas do /conteudo).
function resumoConteudo(dados: DadosWizard): string {
  const titulo = dados.titulo ? `**${dados.titulo}**` : "*(automático: tipo + data/hora)*";
  const quando = dados.data || dados.hora ? `${dados.data || "(sem data)"} às ${dados.hora || "(sem hora)"}` : "*(não definida)*";
  const vagas = Object.entries(dados.funcoes).filter(([, q]) => q > 0);
  const total = vagas.reduce((n, [, q]) => n + q, 0);
  return (
    `📌 Título: ${titulo}\n` +
    `🗓️ Data/Hora: ${quando}\n` +
    `🧭 Tipo: ${rotuloTipo(dados.tipo) || "*(escolha abaixo)*"}\n` +
    (total ? `⚔️ Armas: ${vagas.length} (${total} vagas)\n` : "") +
    requisitosTexto(dados)
  );
}

// Requisitos só aparecem quando o líder definiu algum (Tier/Skip são opcionais).
export function requisitosTexto(dados: DadosWizard): string {
  const partes: string[] = [];
  if (dados.temTier && dados.tier && dados.tier !== "Livre") partes.push(`Tier ${dados.tier}`);
  if (dados.precisaSkip) partes.push("Set de Skip T4");
  return partes.length ? `⚙️ Requisitos: ${partes.join(" · ")}\n` : "";
}

// Tela inicial quando o jogador já tem pings salvos: usar um deles ou criar um novo.
export function montarPayloadEscolhaPing(pings: PingSalvo[], livre: number | null): InteractionCallbackData {
  const linhas = pings.map((p) => {
    const vagas = Object.entries(p.funcoes).filter(([, q]) => q > 0);
    const total = vagas.reduce((n, [, q]) => n + q, 0);
    return `**${p.slot}.** ${p.titulo || "(sem título)"} — ${vagas.length} arma(s), ${total} vaga(s)`;
  });
  const usar: ButtonComponent[] = pings.map((p) => ({
    type: 2 as const,
    custom_id: `ping_usar_${p.slot}`,
    label: `▶️ Usar ping ${p.slot}`.slice(0, 80),
    style: ButtonStyle.Success,
  }));
  const novo: ButtonComponent[] = livre
    ? [{ type: 2 as const, custom_id: `ping_novo_${livre}`, label: "➕ Criar novo", style: ButtonStyle.Primary }]
    : pings.map((p) => ({
      type: 2 as const,
      custom_id: `ping_novo_${p.slot}`,
      label: `➕ Novo (substitui o ${p.slot})`,
      style: ButtonStyle.Secondary,
    }));
  return {
    content: `📣 **Seus pings salvos**\n${linhas.join("\n")}\n\nUse um deles (só escolhe tipo, data e hora) ou crie um novo.`,
    components: [actionRow(...usar), actionRow(...novo)],
  };
}

// Passo 1: tipo (decide o canal) + título/data/hora; requisitos são opcionais.
export function montarPayloadPasso1(dados: DadosWizard): InteractionCallbackData {
  const menuTipo = {
    type: 3 as const,
    custom_id: "config_tipo",
    placeholder: "🧭 Tipo do conteúdo (define o canal de ping)",
    options: TIPOS_CONTEUDO.map((t) => ({
      label: t.label,
      value: t.value,
      emoji: { name: t.emoji },
      default: t.value === dados.tipo,
    })),
  };

  const temDetalhes = dados.titulo || dados.data || dados.hora;
  const temArmas = Object.values(dados.funcoes).some((q) => q > 0);

  return {
    content: `🛠️ **Novo conteúdo**\n${resumoConteudo(dados)}\nEscolha o tipo, ajuste título/data/hora e avance para as armas:`,
    components: [
      actionRow(menuTipo),
      actionRow(
        {
          type: 2 as const,
          style: ButtonStyle.Secondary,
          custom_id: "btn_definir_titulo",
          label: temDetalhes ? "✏️ Editar Título/Data/Hora" : "✏️ Título/Data/Hora",
        },
        {
          type: 2 as const,
          style: ButtonStyle.Secondary,
          custom_id: "btn_requisitos",
          label: "⚙️ Requisitos (opcional)",
        },
      ),
      actionRow({
        type: 2 as const,
        style: ButtonStyle.Success,
        custom_id: "btn_passo2",
        label: temArmas ? "Avançar para as armas ➡️" : "Escolher as armas ➡️",
        disabled: !dados.tipo,
      }),
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

  rows.push(
    actionRow({
      type: 2 as const,
      custom_id: "btn_voltar_passo1",
      label: "⬅️ Voltar",
      style: ButtonStyle.Success,
    }),
  );

  const setSkipTexto = dados.precisaSkip ? "Obrigatório T4+" : "Dispensado";

  return {
    content:
      `⚙️ **Requisitos (opcional)**\n` +
      `• Tier Mínimo: **${dados.tier}**\n` +
      `• Set de Skip: **${setSkipTexto}**`,
    components: rows,
  };
}

// ---------------------------------------------------------------------------
// PASSO 3
// ---------------------------------------------------------------------------
// Limite do Discord: o seletor de foco da tela de quantidades aceita até 25 classes.
export const MAX_CLASSES_PT = 25;

// Passo 3 (escolha): árvore → armas (a função de cada um é marcada depois, no painel). As classes escolhidas se acumulam
// entre as árvores; "Definir quantidades" leva ao painel de +/-.
export function montarPayloadPasso3Selecao(
  dados: DadosWizard,
  emojisResolvidos: Map<string, EmojiResolvido>,
): InteractionCallbackData {
  const escolhidas = new Set(dados.classesAtivas ?? []);
  const arvore = ARVORES.find((a) => a.chave === dados.arvoreAberta) ?? null;

  const opcoesArvores: SelectOption[] = ARVORES.map((a) => {
    const naArvore = [classeGenericaDaArvore(a), ...a.armas.map((arma) => classeDaArma(a, arma))]
      .filter((c) => escolhidas.has(c)).length;
    return {
      label: a.nome,
      value: a.chave,
      description: `${a.armas.length} armas` + (naArvore ? ` · ${naArvore} escolhida${naArvore > 1 ? "s" : ""}` : ""),
      emoji: { name: a.emoji },
      default: a.chave === arvore?.chave,
    };
  });

  const resumo = [...escolhidas].sort(compararClasses).map((c) => formatarClasseParaMensagem(c, emojisResolvidos));

  const linhas: ActionRowComponent[] = [
    actionRow({
      type: 3 as const,
      custom_id: "escolher_arvore",
      placeholder: "🌳 Abrir uma árvore de armas",
      options: opcoesArvores,
    }),
  ];

  if (arvore) {
    const opcoesArmas: SelectOption[] = [
      { classe: classeGenericaDaArvore(arvore), label: `${arvore.nome} (qualquer arma)` },
      ...arvore.armas.map((arma) => ({ classe: classeDaArma(arvore, arma), label: arma.nome })),
    ].map(({ classe, label }) => ({
      label,
      value: classe,
      emoji: { name: arvore.emoji },
      default: escolhidas.has(classe),
    }));
    linhas.push(
      actionRow({
        type: 3 as const,
        custom_id: "selecionar_armas",
        placeholder: `${arvore.emoji} Armas de ${arvore.nome} nesta PT`,
        min_values: 0,
        max_values: opcoesArmas.length,
        options: opcoesArmas,
      }),
    );
  }

  linhas.push(
    actionRow(
      {
        type: 2 as const,
        custom_id: "btn_voltar_passo1",
        label: "⬅️ Voltar",
        style: ButtonStyle.Secondary,
      },
      {
        type: 2 as const,
        custom_id: "btn_limpar_classes",
        label: "🧹 Limpar escolhas",
        style: ButtonStyle.Secondary,
        disabled: escolhidas.size === 0,
      },
      {
        type: 2 as const,
        custom_id: "btn_definir_quantidades",
        label: "➡️ Definir quantidades",
        style: ButtonStyle.Success,
        disabled: escolhidas.size === 0,
      },
    ),
  );

  return {
    content:
      `⚔️ **Armas da PT**\n` +
      `Abra uma **árvore** e marque as armas. As escolhas se somam entre as árvores ` +
      `(máximo ${MAX_CLASSES_PT}).\n\n` +
      `**Escolhidas (${escolhidas.size}/${MAX_CLASSES_PT}):** ` +
      (resumo.length ? resumo.join(", ") : "_nenhuma ainda_"),
    components: linhas,
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
        label: "🔄 Mudar armas",
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
      `🔢 **Quantidade de cada arma**\n` +
      `Escolha a arma no menu e ajuste com ➖/➕:\n\n` +
      `➡️ **Modificando agora:** ${parseClasseComEmoji(classeFocada, emojisResolvidos).nome}\n`,
    components: linhasBotoes,
  };
}

// ---------------------------------------------------------------------------
// PAINEL PÚBLICO (bônus + reconstrução de componentes após inscrição/kick)
// ---------------------------------------------------------------------------
// Select de função (Healer/Tank/...): cada um marca a própria; o líder pode marcar a de outros.
export const ID_ROLE_PAINEL = "vaga_role";
export function montarSelectRole(): ActionRowComponent {
  return actionRow({
    type: 3 as const,
    custom_id: ID_ROLE_PAINEL,
    placeholder: "🎭 Sua função na PT (Healer, Tank, DPS...)",
    options: [
      ...ROLES_PAINEL.map((r) => ({ label: r.label, value: r.value, emoji: { name: r.emoji } })),
      { label: "Tirar função", value: "-", emoji: { name: "🚫" } },
    ],
  });
}

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
      label: "🔎 Ver disponíveis",
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
  componentes.push(montarSelectRole());

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
