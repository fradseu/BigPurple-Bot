// comandoConteudo.ts - /conteudo. Quem já tem pings salvos (até 2) escolhe entre usar um deles
// ou criar um novo (que ocupa o slot livre ou substitui um dos dois). Sem pings, vai direto
// pro Passo 1.
//
// Confirma o comando IMEDIATAMENTE (deferredReply) e só depois lê/escreve no banco — num cold
// start isso pode passar dos 3s que o Discord dá pra reconhecer o comando.
import { deferredReply, deferredUpdate } from "../discord/responses.ts";
import { editarRespostaOriginal, enviarFollowUp } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { criarEstadoWizard, obterEstadoWizard, salvarEstadoWizard } from "../db/ptWizard.ts";
import { listarPings, slotLivre } from "../db/pings.ts";
import { HandlerResult } from "./context.ts";
import { montarPayloadEscolhaPing, montarPayloadPasso1 } from "./ui.ts";

const SESSAO_EXPIRADA = "⚠️ Sessão expirada — use /conteudo de novo pra começar.";

export function handleComandoConteudo(interaction: DiscordInteraction): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const canalId = interaction.channel_id!;
  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredReply(true),
    background: async () => {
      const [dados, pings] = await Promise.all([criarEstadoWizard(liderId, canalId), listarPings(liderId)]);
      if (pings.length === 0) {
        dados.slotPing = 1;
        await salvarEstadoWizard(liderId, dados);
        await editarRespostaOriginal(applicationId, token, montarPayloadPasso1(dados));
        return;
      }
      await editarRespostaOriginal(applicationId, token, montarPayloadEscolhaPing(pings, slotLivre(pings)));
    },
  };
}

// ping_usar_N (carrega título + armas) / ping_novo_N (começa do zero e salva no slot N).
export function lerBotaoPing(customId: string): { acao: "usar" | "novo"; slot: number } | null {
  const m = customId.match(/^ping_(usar|novo)_([12])$/);
  return m ? { acao: m[1] as "usar" | "novo", slot: Number(m[2]) } : null;
}

export function handleBotaoPing(interaction: DiscordInteraction, botao: { acao: "usar" | "novo"; slot: number }): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const dados = await obterEstadoWizard(liderId);
      if (!dados) {
        await enviarFollowUp(applicationId, token, { content: SESSAO_EXPIRADA, flags: 64 });
        return;
      }
      dados.slotPing = botao.slot;
      if (botao.acao === "usar") {
        const ping = (await listarPings(liderId)).find((p) => p.slot === botao.slot);
        if (ping) {
          dados.titulo = ping.titulo;
          dados.funcoes = { ...ping.funcoes };
          dados.classesAtivas = Object.keys(ping.funcoes).filter((c) => ping.funcoes[c] > 0);
          dados.classeFocada = dados.classesAtivas[0] ?? null;
          dados.emQuantidades = dados.classesAtivas.length > 0;
        }
      }
      await salvarEstadoWizard(liderId, dados);
      await editarRespostaOriginal(applicationId, token, montarPayloadPasso1(dados));
    },
  };
}
