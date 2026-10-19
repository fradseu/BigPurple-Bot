// ptDisponiveis.ts - O líder da PT vê o catálogo ANÔNIMO do Pool e convida alguém.
//
//   [👥 Ver disponíveis]  -> lista (só código, classe, tier) filtrada pela PT:
//                            área do canal de ping + atividade + vagas ainda abertas
//   escolhe alguém        -> tela de confirmação
//   [📨 Convidar]         -> manda o pedido pro bot de Pool, que posta o convite na
//                            caixa privada da pessoa (some em 3 min)
//
// Tudo que pode demorar (banco, Discord) roda depois do "pensando..." pra não estourar
// os 3s. O nick de quem aceita só aparece quando o painel da PT é atualizado.
import { deferredReply, deferredUpdate, reply, updateMessage } from "../discord/responses.ts";
import { buscarCanal, buscarMensagem, editarRespostaOriginal } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import {
  areaDaPT,
  extrairAtividadesDaPT,
  extrairDetalhesDaPT,
  extrairTituloDaPT,
  lerValorOpcao,
  montarCatalogo,
  montarTelaCatalogo,
  montarTelaConfirmacao,
  usuariosNaPT,
  vagasAbertas,
} from "../domain/catalogo.ts";
import { listarConvitesPendentesDaPT, listarDisponiveis, obterConfigPool } from "../db/pool.ts";
import { HandlerResult, extrairLiderIdDoCriador, extrairLinhasVagasDoEmbed } from "./context.ts";
import { convidarNoPool, StatusConvite } from "./poolBot.ts";

const SO_LIDER = "❌ Apenas o Líder da PT pode ver os disponíveis e convidar!";

const MSG_STATUS: Record<StatusConvite, string> = {
  enviado: "📨 Convite enviado! Ele vale por **3 minutos**. Se a pessoa aceitar, ela entra na vaga e o painel da PT mostra o nome dela.",
  indisponivel: "😕 Essa pessoa já não está mais disponível. Volte e escolha outra.",
  ja_convidado: "ℹ️ Você já convidou essa pessoa pra esta PT — aguarde ela responder.",
  limite: "⏳ Você já tem muitos convites pendentes pra esta PT. Espere responderem antes de convidar mais.",
  erro: "⚠️ Não consegui enviar o convite agora. Tente de novo em instantes.",
};

type Payload = Parameters<typeof editarRespostaOriginal>[2];

// Monta a tela do catálogo pra uma PT. Devolve a mensagem pronta (ou um aviso do motivo
// de não haver catálogo: pool sem configuração, canal sem área, sem vagas abertas...).
async function montarCatalogoDaPT(params: {
  interaction: DiscordInteraction;
  ptMsgId: string;
}): Promise<Payload> {
  const { interaction, ptMsgId } = params;
  const guildId = interaction.guild_id;
  const canalId = interaction.channel_id;
  const aviso = (texto: string): Payload => montarTelaCatalogo([], ptMsgId, texto);

  if (!guildId || !canalId) return aviso("Isso só funciona dentro de um servidor.");

  const config = await obterConfigPool(guildId);
  if (!config) return aviso("O Pool ainda não foi configurado neste servidor. Peça a um administrador usar `/pool-painel`.");

  const pt = await buscarMensagem(canalId, ptMsgId);
  if (!pt) return aviso("Não encontrei o painel dessa PT (ela foi apagada?).");

  // A PT mora num tópico do canal de ping; o PAI é que diz a área (PVE/PVP/FAC/Avalon).
  const pai = interaction.channel?.parent_id ?? (await buscarCanal(canalId)).parent_id;
  const area = areaDaPT([pai, canalId], config.areasCanais);
  if (!area) {
    return aviso("Esse canal de ping ainda não está ligado a uma área do Pool. Peça a um administrador.");
  }

  const linhas = extrairLinhasVagasDoEmbed(pt);
  const abertas = vagasAbertas(linhas);
  if (abertas.length === 0) return aviso("Todas as vagas dessa PT já estão preenchidas. 🎉");

  const [candidatos, jaConvidados] = await Promise.all([
    listarDisponiveis({ guildId, area, atividades: extrairAtividadesDaPT(pt.content) }),
    listarConvitesPendentesDaPT(ptMsgId),
  ]);

  // MODO DE TESTE (segredo PT_MODO_TESTE=1, desligado por padrão): deixa o líder aparecer
  // no próprio catálogo, pra dar pra testar o fluxo inteiro com uma conta só.
  const modoTeste = Deno.env.get("PT_MODO_TESTE") === "1";

  const opcoes = montarCatalogo({
    candidatos,
    abertas,
    liderId: modoTeste ? "" : extrairLiderIdDoCriador(pt.content),
    naPT: usuariosNaPT(linhas),
    jaConvidados,
    agoraMs: Date.now(),
  });
  return montarTelaCatalogo(opcoes, ptMsgId);
}

// Botão "👥 Ver disponíveis" no painel da PT (só o líder).
export function handleAbrirCatalogo(interaction: DiscordInteraction): HandlerResult {
  const pt = interaction.message!;
  if (getInteractionUserId(interaction) !== extrairLiderIdDoCriador(pt.content)) {
    return { immediate: reply(SO_LIDER, { ephemeral: true }) };
  }

  const applicationId = interaction.application_id;
  const token = interaction.token;
  return {
    immediate: deferredReply(true),
    background: async () => {
      const tela = await montarCatalogoDaPT({ interaction, ptMsgId: pt.id });
      await editarRespostaOriginal(applicationId, token, tela);
    },
  };
}

// Escolheu alguém na lista -> tela de confirmação (sem banco: tudo vem no valor da opção).
export function handleSelecionarCandidato(interaction: DiscordInteraction, ptMsgId: string): HandlerResult {
  const escolha = lerValorOpcao(interaction.data?.values?.[0] ?? "");
  if (!escolha) {
    return { immediate: reply("⚠️ Opção inválida. Abra a lista de novo.", { ephemeral: true }) };
  }
  const tela = montarTelaConfirmacao(escolha.codigo, escolha.classe, escolha.dispId, ptMsgId);
  return { immediate: updateMessage(tela.content, tela.components, tela.embeds) };
}

// "↩️ Voltar": redesenha o catálogo (a mensagem atual é a do líder, não a da PT).
export function handleVoltarCatalogo(interaction: DiscordInteraction, ptMsgId: string): HandlerResult {
  const applicationId = interaction.application_id;
  const token = interaction.token;
  return {
    immediate: deferredUpdate(),
    background: async () => {
      const pt = interaction.channel_id ? await buscarMensagem(interaction.channel_id, ptMsgId) : null;
      if (!pt || getInteractionUserId(interaction) !== extrairLiderIdDoCriador(pt.content)) {
        await editarRespostaOriginal(applicationId, token, montarTelaCatalogo([], ptMsgId, SO_LIDER));
        return;
      }
      await editarRespostaOriginal(applicationId, token, await montarCatalogoDaPT({ interaction, ptMsgId }));
    },
  };
}

// "📨 Convidar": confirma o líder DE NOVO no servidor (o botão vem de uma mensagem
// privada, mas o ID dele é a fonte da verdade) e pede o envio pro bot de Pool.
export function handleConfirmarConvite(
  interaction: DiscordInteraction,
  dados: { dispId: string; ptMsgId: string; classe: string },
): HandlerResult {
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const liderId = getInteractionUserId(interaction);

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const terminar = (texto: string) =>
        editarRespostaOriginal(applicationId, token, {
          content: "",
          embeds: [{ title: "📨 Convite", description: texto, color: 0x7b2cbf }],
          components: [],
        });

      const guildId = interaction.guild_id;
      const canalId = interaction.channel_id;
      if (!guildId || !canalId) return await terminar("Isso só funciona dentro de um servidor.");

      const pt = await buscarMensagem(canalId, dados.ptMsgId);
      if (!pt) return await terminar("Não encontrei o painel dessa PT (ela foi apagada?).");
      if (extrairLiderIdDoCriador(pt.content) !== liderId) return await terminar(SO_LIDER);

      const resultados = await convidarNoPool({
        guild_id: guildId,
        pt_canal_id: canalId,
        pt_mensagem_id: dados.ptMsgId,
        pt_titulo: extrairTituloDaPT(pt.content),
        pt_detalhes: extrairDetalhesDaPT(pt.content),
        lider_user_id: liderId,
        itens: [{ disponibilidade_id: dados.dispId, classe: dados.classe }],
      });

      const status = resultados?.find((r) => r.disponibilidade_id === dados.dispId)?.status ?? "erro";
      await terminar(MSG_STATUS[status]);
    },
  };
}
