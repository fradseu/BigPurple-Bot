// decisao.ts - Botões da mensagem de candidatura (só recrutadores):
//   ✅ Aprovar / ❌ Recusar  -> grava a decisão e fecha a mensagem
//   🔄 Atualizar dossiê      -> refaz a consulta ao Albion (ex: API estava fora)
import { gerarDossie } from "../albion/dossie.ts";
import { COR_APROVADA, COR_RECUSADA } from "../config.ts";
import {
  atualizarDossie,
  decidirCandidatura,
  obterCandidatura,
} from "../db/candidaturas.ts";
import { obterConfig, permissoesDe } from "../db/config.ts";
import { contextoDoMembro, nomeExibicao } from "../discord/membro.ts";
import { deferredUpdate } from "../discord/responses.ts";
import { editarMensagem, enviarFollowUp } from "../discord/rest.ts";
import {
  ActionRowComponent,
  ButtonStyle,
  ComponentType,
  DiscordInteraction,
  getInteractionUserId,
} from "../discord/types.ts";
import { ehRecrutador } from "../domain/permissoes.ts";
import { HandlerResult } from "./context.ts";
import { montarMensagemCandidatura } from "./mensagemCandidatura.ts";
import { Dossie } from "../albion/dossie.ts";

const SO_RECRUTADOR =
  "❌ Só quem tem o cargo de **recrutador** (ou administradores) pode usar esses botões.";

// Quem clicou é recrutador? Lê a config do servidor no banco — por isso roda
// no background (depois do defer), não na resposta de 3s do Discord.
async function clicouUmRecrutador(interaction: DiscordInteraction): Promise<boolean> {
  const config = interaction.guild_id ? await obterConfig(interaction.guild_id) : null;
  return ehRecrutador(contextoDoMembro(interaction), permissoesDe(config));
}

export function handleDecisao(
  interaction: DiscordInteraction,
  acao: "aprovada" | "recusada",
  candidaturaId: string,
): HandlerResult {
  const mensagem = interaction.message!;
  const canalId = interaction.channel_id!;
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const quem = nomeExibicao(interaction);
  const quemId = getInteractionUserId(interaction);

  return {
    immediate: deferredUpdate(),
    background: async () => {
      if (!(await clicouUmRecrutador(interaction))) {
        await enviarFollowUp(applicationId, token, { content: SO_RECRUTADOR, flags: 64 });
        return;
      }

      const decidida = await decidirCandidatura(candidaturaId, acao, quemId);
      if (!decidida) {
        await enviarFollowUp(applicationId, token, {
          content: "⚠️ Essa candidatura já foi decidida por outro recrutador.",
          flags: 64,
        });
        return;
      }

      const aprovada = acao === "aprovada";
      const embedAtual = mensagem.embeds?.[0] ?? {};
      const quando = new Date().toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });

      // Mantém só o botão de link (Killboard); Aprovar/Recusar/Atualizar somem.
      const botoesLink = (mensagem.components ?? [])
        .flatMap((linha) => linha.components)
        .filter((c) => c.type === ComponentType.Button && c.style === ButtonStyle.Link);
      const componentes: ActionRowComponent[] = botoesLink.length > 0
        ? [{ type: ComponentType.ActionRow, components: botoesLink }]
        : [];

      await editarMensagem(canalId, mensagem.id, {
        embeds: [{
          ...embedAtual,
          color: aprovada ? COR_APROVADA : COR_RECUSADA,
          footer: {
            text: `${aprovada ? "✅ Aprovada" : "❌ Recusada"} por ${quem} em ${quando}`,
          },
        }],
        components: componentes,
      });
    },
  };
}

export function handleAtualizarDossie(
  interaction: DiscordInteraction,
  candidaturaId: string,
): HandlerResult {
  const mensagem = interaction.message!;
  const canalId = interaction.channel_id!;
  const applicationId = interaction.application_id;
  const token = interaction.token;

  return {
    immediate: deferredUpdate(),
    background: async () => {
      if (!(await clicouUmRecrutador(interaction))) {
        await enviarFollowUp(applicationId, token, { content: SO_RECRUTADOR, flags: 64 });
        return;
      }

      const candidatura = await obterCandidatura(candidaturaId);
      if (!candidatura) {
        await enviarFollowUp(applicationId, token, {
          content: "⚠️ Não achei essa candidatura no banco.",
          flags: 64,
        });
        return;
      }
      if (candidatura.status !== "pendente") {
        await enviarFollowUp(applicationId, token, {
          content: "⚠️ Essa candidatura já foi decidida — não dá mais pra atualizar o dossiê.",
          flags: 64,
        });
        return;
      }

      const dossie: Dossie = await gerarDossie(candidatura.nickname, candidatura.fama_declarada);
      await atualizarDossie(
        candidatura.id,
        dossie.jogador?.id ?? candidatura.albion_player_id,
        dossie as unknown as Record<string, unknown>,
      );

      const { embed, components } = await montarMensagemCandidatura(candidatura, dossie);
      await editarMensagem(canalId, mensagem.id, { embeds: [embed], components });
    },
  };
}
