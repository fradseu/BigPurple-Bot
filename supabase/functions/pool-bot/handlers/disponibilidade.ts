// disponibilidade.ts - O que a pessoa faz: abrir o formulário, escolher, confirmar,
// cancelar e sair da lista. Tudo que toca banco/Discord roda em background
// (depois de confirmar o clique), pra não estourar os 3s do Discord.
import {
  apagarWizard,
  cancelarAtiva,
  obterCaixa,
  obterConfigPool,
  obterWizard,
  registrarDisponibilidade,
  salvarWizard,
} from "../db/pool.ts";
import { deferredReply, deferredUpdate } from "../discord/responses.ts";
import { editarRespostaOriginal, enviarFollowUp } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import {
  aplicarSelecao,
  calcularExpiracao,
  CampoWizard,
  estadoInicial,
  lerEstado,
  wizardCompleto,
} from "../domain/wizard.ts";
import { atualizarControle, garantirCaixa, resumoDe } from "./caixa.ts";
import { HandlerResult } from "./context.ts";
import { montarFormulario } from "./formulario.ts";

const SO_EM_SERVIDOR = "⚠️ Isso só funciona dentro de um servidor.";
const POOL_NAO_CONFIGURADO =
  "⚠️ O pool ainda não foi configurado neste servidor. Peça a um administrador pra usar `/pool-painel` no canal do pool.";

const CAMPOS: CampoWizard[] = ["atividades", "classes", "tier", "duracao"];

export function ehCampoWizard(valor: string): valor is CampoWizard {
  return (CAMPOS as string[]).includes(valor);
}

// "Ficar disponível" / "Alterar": abre o formulário vazio (zera qualquer
// rascunho antigo, senão o formulário mostraria uma coisa e o banco lembraria outra).
export function handleAbrirFormulario(interaction: DiscordInteraction): HandlerResult {
  const guildId = interaction.guild_id;
  const userId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredReply(true),
    background: async () => {
      if (!guildId) return await editarRespostaOriginal(applicationId, token, { content: SO_EM_SERVIDOR });

      const config = await obterConfigPool(guildId);
      if (!config?.canal_pool_id) {
        return await editarRespostaOriginal(applicationId, token, { content: POOL_NAO_CONFIGURADO });
      }

      const estado = estadoInicial();
      await salvarWizard(guildId, userId, estado as unknown as Record<string, unknown>);
      await editarRespostaOriginal(applicationId, token, montarFormulario(estado));
    },
  };
}

export function handleSelecao(interaction: DiscordInteraction, campo: CampoWizard): HandlerResult {
  const guildId = interaction.guild_id;
  const userId = getInteractionUserId(interaction);
  const valores = interaction.data?.values ?? [];
  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      if (!guildId) return;
      const linha = await obterWizard(guildId, userId);
      const novo = aplicarSelecao(lerEstado(linha?.dados), campo, valores);
      await salvarWizard(guildId, userId, novo as unknown as Record<string, unknown>);
      await editarRespostaOriginal(applicationId, token, montarFormulario(novo));
    },
  };
}

export function handleConfirmar(interaction: DiscordInteraction): HandlerResult {
  const guildId = interaction.guild_id;
  const userId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      if (!guildId) return await editarRespostaOriginal(applicationId, token, { content: SO_EM_SERVIDOR });

      const linha = await obterWizard(guildId, userId);
      const estado = lerEstado(linha?.dados);
      if (!wizardCompleto(estado) || !estado.tier || !estado.duracaoMin) {
        return await editarRespostaOriginal(
          applicationId,
          token,
          montarFormulario(estado, "⚠️ Ainda falta escolher algo antes de confirmar."),
        );
      }

      const config = await obterConfigPool(guildId);
      if (!config?.canal_pool_id) {
        return await editarRespostaOriginal(applicationId, token, { content: POOL_NAO_CONFIGURADO });
      }

      const caixa = await garantirCaixa(guildId, userId, config.canal_pool_id);
      const disponibilidade = await registrarDisponibilidade({
        guild_id: guildId,
        user_id: userId,
        pseudonimo: caixa.pseudonimo,
        atividades: estado.atividades,
        classes: estado.classes,
        tier: estado.tier,
        expira_em: calcularExpiracao(Date.now(), estado.duracaoMin).toISOString(),
      });
      await atualizarControle(caixa, resumoDe(disponibilidade));
      await apagarWizard(guildId, userId);

      await editarRespostaOriginal(applicationId, token, {
        content: `✅ **Você está disponível!** Seus convites chegam na sua caixa privada: <#${caixa.thread_id}>\n` +
          `Pra sair da lista ou mudar algo, use os botões lá.`,
        embeds: [],
        components: [],
      });
    },
  };
}

export function handleCancelarFormulario(interaction: DiscordInteraction): HandlerResult {
  const guildId = interaction.guild_id;
  const userId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      if (guildId) await apagarWizard(guildId, userId);
      await editarRespostaOriginal(applicationId, token, {
        content: "Tudo bem, não mudei nada.",
        embeds: [],
        components: [],
      });
    },
  };
}

// "Sair da lista" (botão da mensagem de controle, dentro da caixa).
export function handleSair(interaction: DiscordInteraction): HandlerResult {
  const guildId = interaction.guild_id;
  const userId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      if (!guildId) return;
      const tinha = await cancelarAtiva(guildId, userId);
      const caixa = await obterCaixa(guildId, userId);
      if (caixa) await atualizarControle(caixa, null);
      await enviarFollowUp(applicationId, token, {
        content: tinha ? "🚪 Pronto, você saiu da lista." : "Você já não estava na lista.",
        flags: 64,
      });
    },
  };
}
