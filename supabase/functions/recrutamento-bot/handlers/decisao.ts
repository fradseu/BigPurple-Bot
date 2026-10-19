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
import { ConfigRow } from "../db/client.ts";
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
import { aplicarAprovacao, resumoDaAplicacao } from "./aprovacao.ts";
import { HandlerResult } from "./context.ts";
import { montarMensagemCandidatura } from "./mensagemCandidatura.ts";
import { Dossie } from "../albion/dossie.ts";

const SO_RECRUTADOR =
  "❌ Só quem tem o cargo de **recrutador** (ou administradores) pode usar esses botões.";

// Quem clicou é recrutador? Lê a config do servidor no banco — por isso roda
// no background (depois do defer), não na resposta de 3s do Discord. Devolve a
// config junto porque a aprovação também precisa dela (cargo de Membro).
async function verificarRecrutador(
  interaction: DiscordInteraction,
): Promise<{ ehRecrutador: boolean; config: ConfigRow | null }> {
  const config = interaction.guild_id ? await obterConfig(interaction.guild_id) : null;
  return {
    ehRecrutador: ehRecrutador(contextoDoMembro(interaction), permissoesDe(config)),
    config,
  };
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
      const { ehRecrutador: podeDecidir, config } = await verificarRecrutador(interaction);
      if (!podeDecidir) {
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

      // Aprovar = também aplicar apelido do jogo + cargo de Membro. A decisão já
      // está gravada; se algo falhar aqui, ela continua valendo e o recrutador
      // recebe o motivo (e a mensagem mostra o que foi de fato aplicado).
      let rodape = `${aprovada ? "✅ Aprovada" : "❌ Recusada"} por ${quem} em ${quando}`;
      let avisos: string[] = [];
      if (aprovada && interaction.guild_id) {
        const resultado = await aplicarAprovacao({
          guildId: interaction.guild_id,
          candidatura: decidida,
          config,
          aprovadoPorNome: quem,
        });
        rodape += ` · ${resumoDaAplicacao(resultado)}`;
        avisos = resultado.avisos;
      }

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
          footer: { text: rodape },
        }],
        components: componentes,
      });

      if (avisos.length > 0) {
        await enviarFollowUp(applicationId, token, {
          content: `✅ Candidatura aprovada, mas **${avisos.length === 1 ? "um ponto precisa" : "alguns pontos precisam"} ` +
            `da sua atenção:**\n${avisos.map((a) => `• ${a}`).join("\n")}`,
          flags: 64,
        });
      }
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
      if (!(await verificarRecrutador(interaction)).ehRecrutador) {
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
