// painelFinal.ts - Gera o painel público (equivalente ao "PASSO FINAL:
// ENVIAR O PAINEL DE INSCRIÇÃO PÚBLICO" do v1).
//
// A lista de vagas vive na DESCRIPTION de um Embed (limite de 4096
// caracteres), não no content da mensagem (limite de 2000) — com muitas
// classes/vagas selecionadas, o texto cresce rápido e estourava o limite do
// content. O content fica só com cabeçalho fixo (título, criador, atividade,
// requisitos, @everyone), que nunca cresce com o número de vagas.
//
// Confirma o clique IMEDIATAMENTE (deferredUpdate) e faz todo o trabalho
// pesado (ler wizard, buscar emojis, criar tópico, enviar mensagem, apagar
// wizard) em background — qualquer uma dessas chamadas sozinha já pode passar
// de 1s num cold start, e juntas estourariam fácil os 3s do Discord.
import { deferredUpdate } from "../discord/responses.ts";
import {
  buscarEmojisDaGuilda,
  criarTopico,
  editarRespostaOriginal,
  enviarFollowUp,
  enviarMensagem,
} from "../discord/rest.ts";
import {
  ButtonStyle,
  DiscordEmbed,
  DiscordInteraction,
  SelectOption,
  actionRow,
  getInteractionUserId,
} from "../discord/types.ts";
import { apagarEstadoWizard, DadosWizard, obterEstadoWizard } from "../db/ptWizard.ts";
import { ZONAS } from "../config.ts";
import {
  aplicarEmojisNoTexto,
  compararClasses,
  emojiParaComponente,
  montarMapaEmojis,
  parseClasseComEmoji,
} from "../domain/emoji.ts";
import { atualizarResumoVagas, gerarLinhasDaFuncao } from "../domain/vagas.ts";
import { calcularDificuldade } from "../domain/dificuldade.ts";
import { ID_ABRIR_CATALOGO } from "../domain/catalogo.ts";
import { HandlerResult } from "./context.ts";
import { montarBotoesBonus } from "./ui.ts";

const SESSAO_EXPIRADA = "⚠️ Sessão expirada — use /conteudo de novo pra começar.";
const LIMITE_EMBED_DESCRIPTION = 4096;

// Quando o líder não edita o título manualmente, monta um a partir da
// composição da PT (zona | atividades | cidade) em vez do genérico antigo —
// fica muito mais informativo pra quem só bate o olho no canal/tópico.
function montarTituloAutomatico(dados: DadosWizard): string {
  const zonaInfo = ZONAS.find((z) => z.value === dados.zona);
  const zonaTexto = zonaInfo?.label ?? dados.zona;
  return `${zonaTexto} | ${dados.atividades.join(" + ")} | ${dados.cidade}`;
}

export function handleGerarPainelFinal(interaction: DiscordInteraction): HandlerResult {
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

      const vagasFiltradas = Object.entries(dados.funcoes)
        .filter(([, qtd]) => qtd > 0)
        .sort(([a], [b]) => compararClasses(a, b));
      if (vagasFiltradas.length === 0) {
        await enviarFollowUp(applicationId, token, {
          content:
            "⚠️ Você precisa adicionar pelo menos 1 vaga na composição da sua PT antes de gerar o painel!",
          flags: 64,
        });
        return;
      }

      const emojisGuilda = guildId ? await buscarEmojisDaGuilda(guildId) : [];
      const mapaEmojis = montarMapaEmojis(emojisGuilda);

      let linhasVagas: string[] = [];
      const opcoesDropdown: SelectOption[] = [];

      for (const [classe, maximo] of vagasFiltradas) {
        // Uma linha por vaga individual — dá pra ver exatamente quem ocupa
        // qual vaga + bônus de cada um.
        linhasVagas = linhasVagas.concat(gerarLinhasDaFuncao(classe, maximo, mapaEmojis));

        const { nome, emoji } = parseClasseComEmoji(classe, mapaEmojis);
        opcoesDropdown.push({
          label: `${nome} (Max ${maximo})`,
          value: classe,
          emoji: emojiParaComponente(emoji),
        });
      }

      const tituloFinal =
        dados.titulo && dados.titulo.length > 0 ? dados.titulo : montarTituloAutomatico(dados);

      const linhaDataHora =
        dados.data || dados.hora
          ? `🗓️ **Quando:** ${dados.data || "A definir"} às ${dados.hora || "A definir"}\n`
          : "";

      const conteudoFinal = aplicarEmojisNoTexto(
        `**${tituloFinal}**\n` +
        `👑 Criador: <@${liderId}>\n` +
        `📋 **Atividade:** ${dados.atividades.join(" + ")}\n` +
        `📍 **Ponto de Encontro:** ${dados.cidade}\n` +
        `🗺️ **Ambiente:** ${dados.zona}\n` +
        linhaDataHora +
        `\n⚔️ **REQUISITOS MÍNIMOS:**\n` +
        `• **Builds tier:** ${dados.tier}\n` +
        `• **Set de Skip:** ${dados.precisaSkip ? "Obrigatório Mínimo T4" : "Dispensado"}\n\n` +
        `💬 Escolha seu papel no dropdown abaixo. Caso desista da vaga, clique no botão ❌ Sair da PT.\n` +
        `@everyone`,
      );

      const dropdownPublico = {
        type: 3 as const,
        custom_id: "vaga_publica_inscrever",
        placeholder: "Selecione sua classe para entrar nesta PT",
        options: opcoesDropdown,
      };

      const btnDesistir = {
        type: 2 as const,
        custom_id: "vaga_publica_desistir",
        label: "❌ Sair da PT",
        style: ButtonStyle.Danger,
      };

      const btnSalaVoz = {
        type: 2 as const,
        custom_id: "sala_voz_toggle",
        label: "🔊 Criar Sala de Voz",
        style: ButtonStyle.Primary,
      };

      const btnDisponiveis = {
        type: 2 as const,
        custom_id: ID_ABRIR_CATALOGO,
        label: "👥 Ver disponíveis",
        style: ButtonStyle.Secondary,
      };

      const dificuldadeInfo = calcularDificuldade(dados);

      const linhasVagasComResumo = atualizarResumoVagas(linhasVagas);
      const descriptionEmbed = aplicarEmojisNoTexto(linhasVagasComResumo.join("\n"));

      // O Discord recusa qualquer embed com description maior que 4096
      // caracteres. Avisa ANTES de criar o tópico e tentar enviar, em vez de
      // deixar quebrar no meio (e sem deixar tópico órfão pra trás).
      if (descriptionEmbed.length > LIMITE_EMBED_DESCRIPTION) {
        await enviarFollowUp(applicationId, token, {
          content:
            `⚠️ A lista de vagas ficou grande demais pro Discord ` +
            `(${descriptionEmbed.length}/${LIMITE_EMBED_DESCRIPTION} caracteres). ` +
            `Volta no "🔄 Mudar Classes" e reduz o número de classes/vagas dessa PT.`,
          flags: 64,
        });
        return;
      }

      const embedVagas: DiscordEmbed = {
        title: "📝 Inscrições Abertas",
        description: descriptionEmbed,
      };
      if (dificuldadeInfo) embedVagas.image = { url: dificuldadeInfo.value };

      // Cria o tópico ANTES de enviar o painel, e manda o painel DENTRO dele
      // — se der erro (ex: canal não suporta tópicos), cai de volta pro canal normal.
      let canalDestinoId = dados.canalId;
      try {
        const topico = await criarTopico(dados.canalId, tituloFinal, 1440);
        canalDestinoId = topico.id;
      } catch (err) {
        console.error("Erro ao criar o tópico do painel:", err);
        const detalhe = err instanceof Error ? err.message : String(err);
        await enviarFollowUp(applicationId, token, {
          content:
            `⚠️ Não consegui criar o tópico do painel, vou tentar mandar direto no canal.\n` +
            `\`\`\`${detalhe.slice(0, 1900)}\`\`\``,
          flags: 64,
        });
      }

      await enviarMensagem(canalDestinoId, {
        content: conteudoFinal,
        embeds: [embedVagas],
        components: [
          actionRow(dropdownPublico),
          montarBotoesBonus(),
          actionRow(btnDesistir, btnSalaVoz, btnDisponiveis),
        ],
      });

      await apagarEstadoWizard(liderId);

      await editarRespostaOriginal(applicationId, token, {
        content: "✅ **Sucesso!** O painel do conteúdo foi gerado e enviado no canal público com sucesso.",
        components: [],
      });
    },
  };
}
