// convite.ts - A pessoa responde um convite na caixa privada dela: Aceitar ou Recusar.
//   Aceitar: pede pro bot de conteúdo preencher a vaga na PT (é o dono da mensagem);
//            se der certo, ela sai do catálogo e os outros convites dela são cancelados.
//   Recusar: some sem avisar ninguém — o líder nunca sabe quem recusou.
import { ConviteRow } from "../db/client.ts";
import {
  cancelarConvitesDaDisponibilidade,
  cancelarOutrosConvites,
  definirStatusConvite,
  marcarDisponibilidadeAceita,
  obterCaixa,
  obterDisponibilidadePorId,
  responderConvite,
} from "../db/pool.ts";
import { deferredUpdate } from "../discord/responses.ts";
import { apagarMensagem, enviarFollowUp } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { AcaoConvite } from "../domain/convite.ts";
import { atualizarControle } from "./caixa.ts";
import { HandlerResult } from "./context.ts";
import { MotivoFalhaPreencher, preencherVagaNaPT } from "./conteudoBot.ts";

const MENSAGEM_EXPIRADO = "⌛ Esse convite expirou ou já foi respondido.";

const MENSAGENS_FALHA: Record<MotivoFalhaPreencher, string> = {
  vaga_lotada: "😕 Essa vaga acabou de ser preenchida por outra pessoa. Você continua na lista pra próximos convites.",
  pt_nao_encontrada: "😕 Essa PT não existe mais. Você continua na lista pra próximos convites.",
  ja_na_pt: "ℹ️ Você já está nessa PT.",
  erro: "⚠️ Não consegui te colocar na PT agora. Tente de novo em instantes — você continua na lista.",
};

// Apaga as mensagens de convites que não valem mais (melhor esforço: uma que falhe
// não pode impedir as outras, nem a resposta principal).
export async function apagarMensagensDeConvites(convites: ConviteRow[]): Promise<void> {
  for (const c of convites) {
    if (!c.thread_id || !c.mensagem_id) continue;
    try {
      await apagarMensagem(c.thread_id, c.mensagem_id);
    } catch (err) {
      console.error("Erro ao apagar mensagem de convite:", err);
    }
  }
}

// Cancela todos os convites pendentes de uma disponibilidade e apaga as mensagens
// (a pessoa saiu da lista ou mudou a disponibilidade: convites antigos perderam o sentido).
export async function cancelarConvitesEApagar(disponibilidadeId: string): Promise<void> {
  const cancelados = await cancelarConvitesDaDisponibilidade(disponibilidadeId);
  await apagarMensagensDeConvites(cancelados);
}

export function handleResponderConvite(
  interaction: DiscordInteraction,
  acao: AcaoConvite,
  conviteId: string,
): HandlerResult {
  const userId = getInteractionUserId(interaction);
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const canalDaMensagem = interaction.channel_id;
  const mensagemId = interaction.message?.id;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const avisar = (content: string) => enviarFollowUp(applicationId, token, { content, flags: 64 });
      const apagarEsta = async () => {
        if (canalDaMensagem && mensagemId) await apagarMensagem(canalDaMensagem, mensagemId);
      };

      // "Pegar" o convite é atômico: só a primeira resposta válida passa.
      const convite = await responderConvite(conviteId, userId, acao === "aceitar" ? "aceito" : "recusado");
      if (!convite) {
        await apagarEsta();
        await avisar(MENSAGEM_EXPIRADO);
        return;
      }

      if (acao === "recusar") {
        await apagarEsta();
        await avisar("Tudo bem! Você continua na lista pra outros convites. 👍");
        return;
      }

      // Aceitar: a disponibilidade precisa ainda estar ativa (a pessoa pode ter saído/mudado).
      const disp = await obterDisponibilidadePorId(convite.disponibilidade_id);
      if (!disp || disp.status !== "ativa") {
        await definirStatusConvite(convite.id, "cancelado");
        await apagarEsta();
        await avisar(MENSAGEM_EXPIRADO);
        return;
      }

      const resultado = await preencherVagaNaPT({
        guildId: convite.guild_id,
        ptCanalId: convite.pt_canal_id,
        ptMensagemId: convite.pt_mensagem_id,
        userId,
        classe: convite.classe,
      });

      if (!resultado.ok) {
        // Não entrou: o convite volta a não valer, mas a pessoa continua disponível.
        await definirStatusConvite(convite.id, "cancelado");
        await apagarEsta();
        await avisar(MENSAGENS_FALHA[resultado.motivo]);
        return;
      }

      // Entrou: sai do catálogo, outros convites dela caem, caixa volta pra "fora da lista".
      await marcarDisponibilidadeAceita(disp.id);
      const outros = await cancelarOutrosConvites(disp.id, convite.id);
      await apagarMensagensDeConvites(outros);

      const caixa = await obterCaixa(convite.guild_id, userId);
      if (caixa) await atualizarControle(caixa, null);

      await apagarEsta();
      await avisar(`✅ **Você entrou na PT!** Vaga: **${convite.classe}**. Confira o painel: <#${convite.pt_canal_id}>`);
    },
  };
}
