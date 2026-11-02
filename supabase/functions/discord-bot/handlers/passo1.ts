// passo1.ts - Configuração inicial (tipo, requisitos opcionais), título via modal,
// e transição pro Passo 2. Equivalente aos blocos "Salvando Passo 1",
// "Transição do Passo 1 para o Passo 2" e "TÍTULO/DESCRIÇÃO CUSTOMIZADO" do v1.
//
// Padrão em todo handler aqui: confirma a interação IMEDIATAMENTE (defer) e
// só faz leitura/escrita no banco depois, em background — uma escrita no
// Postgres pode passar de 1s num cold start, e o Discord só dá 3s pra ackar.
import { deferredUpdate, reply, showModal } from "../discord/responses.ts";
import { editarRespostaOriginal, enviarFollowUp } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import { obterEstadoWizard, salvarEstadoWizard } from "../db/ptWizard.ts";
import { dataHoraAtualBR, normalizarData, normalizarHora } from "../domain/dataHora.ts";
import { HandlerResult } from "./context.ts";
import { montarModalTitulo, montarPayloadPasso1, montarPayloadPasso2 } from "./ui.ts";
import { DadosWizard } from "../db/ptWizard.ts";
import { editarComPainelPasso3 } from "./passo3.ts";

const SESSAO_EXPIRADA = "⚠️ Sessão expirada — use /conteudo de novo pra começar.";

export function handleConfigTipo(interaction: DiscordInteraction): HandlerResult {
  return atualizarPasso1(interaction, (dados) => {
    dados.tipo = interaction.data?.values?.[0] ?? dados.tipo;
  });
}

// Botão "⬅️ Voltar" da tela de requisitos.
export function handleVoltarPasso1(interaction: DiscordInteraction): HandlerResult {
  return atualizarPasso1(interaction, () => {});
}

function atualizarPasso1(interaction: DiscordInteraction, mudar: (dados: DadosWizard) => void): HandlerResult {
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
      mudar(dados);
      await salvarEstadoWizard(liderId, dados);
      await editarRespostaOriginal(applicationId, token, montarPayloadPasso1(dados));
    },
  };
}

// "⚙️ Requisitos (opcional)": tela de Tier/Skip, que volta pro Passo 1.
export function handleBtnRequisitos(interaction: DiscordInteraction): HandlerResult {
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
      await editarRespostaOriginal(applicationId, token, montarPayloadPasso2(dados));
    },
  };
}

// "Avançar para as armas": precisa do tipo (é ele que escolhe o canal de ping).
export function handleBtnPasso2(interaction: DiscordInteraction): HandlerResult {
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
      if (!dados.tipo) {
        await enviarFollowUp(applicationId, token, { content: "⚠️ Escolha o tipo do conteúdo antes de avançar.", flags: 64 });
        return;
      }
      await editarComPainelPasso3(applicationId, token, guildId, dados);
    },
  };
}

// Modal precisa ser a resposta IMEDIATA (o Discord não permite defer antes de
// abrir um modal), então essa é a única leitura de banco que continua síncrona
// aqui — é uma leitura simples por chave primária, rápida o bastante.
export async function handleBtnDefinirTitulo(interaction: DiscordInteraction): Promise<HandlerResult> {
  const liderId = getInteractionUserId(interaction);
  const dados = await obterEstadoWizard(liderId);
  if (!dados) return { immediate: reply(SESSAO_EXPIRADA, { ephemeral: true }) };

  // Pré-preenche com hoje/agora se a pessoa ainda não tiver definido nada —
  // só um valor default no formulário, não salva nada até ela confirmar.
  const padrao = dataHoraAtualBR();
  const modal = montarModalTitulo({
    ...dados,
    data: dados.data || padrao.data,
    hora: dados.hora || padrao.hora,
  });
  return { immediate: showModal(modal.customId, modal.title, modal.components) };
}

export function handleModalTitulo(interaction: DiscordInteraction): HandlerResult {
  const liderId = getInteractionUserId(interaction);
  const linhasModal = interaction.data?.components ?? [];
  const valorTitulo = linhasModal[0]?.components?.[0]?.value ?? "";
  const valorData = linhasModal[1]?.components?.[0]?.value ?? "";
  const valorHora = linhasModal[2]?.components?.[0]?.value ?? "";
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

      dados.titulo = valorTitulo.trim().toUpperCase();
      dados.data = normalizarData(valorData);
      dados.hora = normalizarHora(valorHora);
      await salvarEstadoWizard(liderId, dados);

      const payload = montarPayloadPasso1(dados);
      await editarRespostaOriginal(applicationId, token, payload);
    },
  };
}
