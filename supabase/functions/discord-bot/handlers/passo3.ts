// passo3.ts - Composição da PT: escolher classes, focar uma, ajustar
// quantidade (+/-), voltar pra seleção de classes.
// Confirma a interação primeiro (defer), banco/REST só depois em background.
import { deferredUpdate } from "../discord/responses.ts";
import { buscarEmojisDaGuilda, editarRespostaOriginal, enviarFollowUp } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { DadosWizard, obterEstadoWizard, salvarEstadoWizard } from "../db/ptWizard.ts";
import { montarMapaEmojis } from "../domain/emoji.ts";
import { HandlerResult } from "./context.ts";
import { MAX_CLASSES_PT, montarPayloadPasso3Painel, montarPayloadPasso3Selecao } from "./ui.ts";
import { ARVORES, classeDaArma, classeGenericaDaArvore, CLASSES_FUNCOES } from "../../_shared/armas.ts";

const SESSAO_EXPIRADA = "⚠️ Sessão expirada — use /conteudo de novo pra começar.";

export async function editarComPainelPasso3(
  applicationId: string,
  token: string,
  guildId: string | undefined,
  dados: DadosWizard,
): Promise<void> {
  const emojisGuilda = guildId ? await buscarEmojisDaGuilda(guildId) : [];
  const mapaEmojis = montarMapaEmojis(emojisGuilda);

  // Sessões antigas (sem `emQuantidades`) entram no painel se já tinham classes escolhidas.
  const emQuantidades = dados.emQuantidades ?? Boolean(dados.classesAtivas?.length);
  const payload = emQuantidades && dados.classesAtivas?.length
    ? montarPayloadPasso3Painel(dados, mapaEmojis)
    : montarPayloadPasso3Selecao(dados, mapaEmojis);

  await editarRespostaOriginal(applicationId, token, payload);
}

export function handleSelecionarClasses(interaction: DiscordInteraction): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const valores = interaction.data?.values ?? [];
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const guildId = interaction.guild_id;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }

      dados.classesAtivas = valores;
      dados.emQuantidades = true;
      for (const classe of valores) {
        if (dados.funcoes[classe] === undefined || dados.funcoes[classe] === 0) {
          dados.funcoes[classe] = 1;
        }
      }
      dados.classeFocada = valores[0] ?? null;

      await salvarEstadoWizard(liderId, dados);
      await editarComPainelPasso3(applicationId, token, guildId, dados);
    },
  };
}

export function handleFocarClasse(interaction: DiscordInteraction, classe: string): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const guildId = interaction.guild_id;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }

      dados.classeFocada = classe;
      await salvarEstadoWizard(liderId, dados);
      await editarComPainelPasso3(applicationId, token, guildId, dados);
    },
  };
}

export function handleAjusteQuantidade(
  interaction: DiscordInteraction,
  customId: "painel_add_1" | "painel_rem_1",
): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const guildId = interaction.guild_id;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }
      if (!dados.classeFocada) return;

      const atual = dados.funcoes[dados.classeFocada] ?? 0;
      dados.funcoes[dados.classeFocada] =
        customId === "painel_add_1" ? atual + 1 : Math.max(0, atual - 1);

      await salvarEstadoWizard(liderId, dados);
      await editarComPainelPasso3(applicationId, token, guildId, dados);
    },
  };
}

export function handleVoltarClasses(interaction: DiscordInteraction): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const guildId = interaction.guild_id;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }

      // Volta pra escolha mantendo o que já foi marcado (e as quantidades).
      dados.emQuantidades = false;

      await salvarEstadoWizard(liderId, dados);
      await editarComPainelPasso3(applicationId, token, guildId, dados);
    },
  };
}

// ---------------------------------------------------------------- escolha por função / árvore

// Aplica uma mudança nas classes escolhidas (sem passar do limite) e redesenha a tela de escolha.
function alterarEscolha(
  interaction: DiscordInteraction,
  mudar: (dados: DadosWizard, escolhidas: string[]) => string[] | void,
): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const guildId = interaction.guild_id;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }
      const novas = mudar(dados, [...(dados.classesAtivas ?? [])]);
      if (novas) {
        const unicas = [...new Set(novas)];
        if (unicas.length > MAX_CLASSES_PT) {
          await enviarFollowUp(applicationId, token, {
            content: `⚠️ A PT aceita no máximo ${MAX_CLASSES_PT} classes diferentes; as excedentes ficaram de fora.`,
            flags: 64,
          });
        }
        dados.classesAtivas = unicas.slice(0, MAX_CLASSES_PT);
      }
      dados.emQuantidades = false;
      await salvarEstadoWizard(liderId, dados);
      await editarComPainelPasso3(applicationId, token, guildId, dados);
    },
  };
}

const ehFuncao = (c: string) => CLASSES_FUNCOES.includes(c);

export function handleSelecionarFuncoes(interaction: DiscordInteraction): HandlerResult {
  const valores = (interaction.data?.values ?? []).filter(ehFuncao);
  return alterarEscolha(interaction, (_d, escolhidas) => [...escolhidas.filter((c) => !ehFuncao(c)), ...valores]);
}

export function handleEscolherArvore(interaction: DiscordInteraction): HandlerResult {
  const chave = interaction.data?.values?.[0] ?? null;
  return alterarEscolha(interaction, (dados) => {
    dados.arvoreAberta = ARVORES.some((a) => a.chave === chave) ? chave : null;
  });
}

export function handleSelecionarArmas(interaction: DiscordInteraction): HandlerResult {
  const valores = interaction.data?.values ?? [];
  return alterarEscolha(interaction, (dados, escolhidas) => {
    const arvore = ARVORES.find((a) => a.chave === dados.arvoreAberta);
    if (!arvore) return;
    const daArvore = new Set([classeGenericaDaArvore(arvore), ...arvore.armas.map((a) => classeDaArma(arvore, a))]);
    return [...escolhidas.filter((c) => !daArvore.has(c)), ...valores.filter((v) => daArvore.has(v))];
  });
}

export function handleLimparClasses(interaction: DiscordInteraction): HandlerResult {
  return alterarEscolha(interaction, (dados) => {
    dados.funcoes = {};
    dados.classeFocada = null;
    return [];
  });
}

// Vai pra tela de quantidades: classe nova começa com 1 vaga; a que saiu some das quantidades.
export function handleDefinirQuantidades(interaction: DiscordInteraction): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const guildId = interaction.guild_id;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }
      const classes = dados.classesAtivas ?? [];
      if (classes.length === 0) return;
      const funcoes: Record<string, number> = {};
      for (const c of classes) funcoes[c] = dados.funcoes[c] && dados.funcoes[c] > 0 ? dados.funcoes[c] : 1;
      dados.funcoes = funcoes;
      if (!dados.classeFocada || !classes.includes(dados.classeFocada)) dados.classeFocada = classes[0];
      dados.emQuantidades = true;
      await salvarEstadoWizard(liderId, dados);
      await editarComPainelPasso3(applicationId, token, guildId, dados);
    },
  };
}
