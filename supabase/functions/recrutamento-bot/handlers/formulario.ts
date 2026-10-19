// formulario.ts - O formulário do candidato.
//   1. clique em "Solicitar ingresso"  -> abre o modal (resposta imediata, sem banco)
//   2. envio do modal                  -> confirma NA HORA ("pensando...") e, em
//      background: consulta o Albion, salva no Supabase e posta o dossiê no
//      canal dos recrutadores. (Albion + Supabase + Discord juntos passam fácil
//      dos 3s que o Discord dá pra responder — por isso o defer.)
import { gerarDossie } from "../albion/dossie.ts";
import { CANAL_RECRUTADORES_ID, CARGO_RECRUTADOR_ID } from "../config.ts";
import {
  apagarCandidatura,
  buscarPendenteDoUsuario,
  CandidaturaDuplicadaError,
  criarCandidatura,
  registrarMensagem,
} from "../db/candidaturas.ts";
import { lerFamaDeclarada } from "../domain/fama.ts";
import { deferredReply, showModal } from "../discord/responses.ts";
import {
  actionRow,
  ComponentType,
  DiscordInteraction,
  getInteractionUserId,
  TextInputStyle,
} from "../discord/types.ts";
import { editarRespostaOriginal, enviarMensagem } from "../discord/rest.ts";
import { HandlerResult } from "./context.ts";
import { montarMensagemCandidatura } from "./mensagemCandidatura.ts";

export const ID_MODAL_FORMULARIO = "rec_modal_form";

export function handleAbrirFormulario(): HandlerResult {
  return {
    immediate: showModal(ID_MODAL_FORMULARIO, "Solicitar ingresso", [
      actionRow({
        type: ComponentType.TextInput,
        custom_id: "nickname",
        style: TextInputStyle.Short,
        label: "Nickname no Albion",
        placeholder: "Exatamente como aparece no jogo",
        min_length: 3,
        max_length: 32,
        required: true,
      }),
      actionRow({
        type: ComponentType.TextInput,
        custom_id: "fama",
        style: TextInputStyle.Short,
        label: "Fama total",
        placeholder: "Ex: 1,33b ou 850m",
        max_length: 20,
        required: true,
      }),
      actionRow({
        type: ComponentType.TextInput,
        custom_id: "origem",
        style: TextInputStyle.Paragraph,
        label: "Como conheceu a guilda?",
        max_length: 300,
        required: true,
      }),
    ]),
  };
}

function lerCamposModal(interaction: DiscordInteraction): Record<string, string> {
  const campos: Record<string, string> = {};
  for (const linha of interaction.data?.components ?? []) {
    for (const c of linha.components) campos[c.custom_id] = c.value;
  }
  return campos;
}

export function handleEnviarFormulario(interaction: DiscordInteraction): HandlerResult {
  const campos = lerCamposModal(interaction);
  const nickname = (campos.nickname ?? "").trim();
  const famaTexto = (campos.fama ?? "").trim();
  const origem = (campos.origem ?? "").trim();

  const userId = getInteractionUserId(interaction);
  const user = interaction.member?.user ?? interaction.user;
  const username = user?.global_name ?? user?.username ?? userId;
  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredReply(true), // só o candidato vê "pensando..." e a confirmação
    background: async () => {
      if (!CANAL_RECRUTADORES_ID) {
        await editarRespostaOriginal(applicationId, token, {
          content: "⚠️ O recrutamento ainda não foi configurado (falta o canal dos recrutadores). Avise um administrador.",
        });
        return;
      }

      const pendente = await buscarPendenteDoUsuario(userId);
      if (pendente) {
        await editarRespostaOriginal(applicationId, token, {
          content: "⏳ Você já tem uma candidatura **em análise**. Aguarde o retorno dos recrutadores.",
        });
        return;
      }

      const dossie = await gerarDossie(nickname, famaTexto);

      let candidatura;
      try {
        candidatura = await criarCandidatura({
          discord_user_id: userId,
          discord_username: username,
          nickname,
          fama_declarada: famaTexto,
          fama_declarada_num: lerFamaDeclarada(famaTexto),
          como_conheceu: origem,
          albion_player_id: dossie.jogador?.id ?? null,
          dossie: dossie as unknown as Record<string, unknown>,
        });
      } catch (err) {
        if (err instanceof CandidaturaDuplicadaError) {
          await editarRespostaOriginal(applicationId, token, {
            content: "⏳ Você já tem uma candidatura **em análise**. Aguarde o retorno dos recrutadores.",
          });
          return;
        }
        throw err;
      }

      try {
        const { embed, components } = await montarMensagemCandidatura(candidatura, dossie);
        const mensagem = await enviarMensagem(CANAL_RECRUTADORES_ID, {
          content: CARGO_RECRUTADOR_ID
            ? `<@&${CARGO_RECRUTADOR_ID}> nova candidatura de <@${userId}>`
            : `Nova candidatura de <@${userId}>`,
          embeds: [embed],
          components,
          allowed_mentions: { roles: CARGO_RECRUTADOR_ID ? [CARGO_RECRUTADOR_ID] : [], users: [] },
        });
        await registrarMensagem(candidatura.id, CANAL_RECRUTADORES_ID, mensagem.id);
      } catch (err) {
        // Sem mensagem no canal, a candidatura ficaria "fantasma" no banco e
        // o candidato nunca poderia tentar de novo (travaria no "já tem pendente").
        await apagarCandidatura(candidatura.id);
        throw err;
      }

      await editarRespostaOriginal(applicationId, token, {
        content: "✅ **Candidatura enviada!** Os recrutadores já foram avisados. Você será contatado por aqui no Discord.",
      });
    },
  };
}
