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
import { TIPOS_CONTEUDO } from "../config.ts";
import { salvarPing } from "../db/pings.ts";
import { obterConfigPool } from "../db/pool.ts";
import {
  aplicarEmojisNoTexto,
  compararClasses,
  emojiParaComponente,
  montarMapaEmojis,
  parseClasseComEmoji,
} from "../domain/emoji.ts";
import { atualizarResumoVagas, gerarLinhasDaFuncao } from "../domain/vagas.ts";
import { ID_ABRIR_CATALOGO } from "../domain/catalogo.ts";
import { HandlerResult } from "./context.ts";
import { montarBotoesBonus, montarSelectRole, requisitosTexto } from "./ui.ts";

async function canalDoTipo(guildId: string, tipo: string): Promise<string | null> {
  try {
    const config = await obterConfigPool(guildId);
    const par = Object.entries(config?.areasCanais ?? {}).find(([, area]) => area === tipo);
    return par?.[0] ?? null;
  } catch (err) {
    console.error("Erro ao ler canais de ping:", err);
    return null;
  }
}

const SESSAO_EXPIRADA = "⚠️ Sessão expirada — use /conteudo de novo pra começar.";
const LIMITE_EMBED_DESCRIPTION = 4096;

// Sem título digitado: "PvE | 02/11 às 20:30".
function montarTituloAutomatico(dados: DadosWizard): string {
  const tipo = TIPOS_CONTEUDO.find((t) => t.value === dados.tipo)?.label ?? "Conteúdo";
  const quando = [dados.data, dados.hora].filter(Boolean).join(" às ");
  return quando ? `${tipo} | ${quando}` : tipo;
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

      const requisitos = requisitosTexto(dados);
      const conteudoFinal = aplicarEmojisNoTexto(
        `**${tituloFinal}**\n` +
        `👑 Criador: <@${liderId}>\n` +
        linhaDataHora +
        (requisitos ? `${requisitos}` : "") +
        `\n💬 Escolha sua arma no menu abaixo e marque sua função em 🎭. Caso desista, clique em ❌ Sair da PT.\n` +
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
        label: "🔎 Ver disponíveis",
        style: ButtonStyle.Secondary,
      };

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

      // Cria o tópico ANTES de enviar o painel, e manda o painel DENTRO dele
      // — se der erro (ex: canal não suporta tópicos), cai de volta pro canal normal.
      // O tipo escolhe o canal de ping (mesmo mapa do Pool); sem mapa, fica no canal do comando.
      const canalPing = guildId && dados.tipo ? await canalDoTipo(guildId, dados.tipo) : null;
      const canalBase = canalPing ?? dados.canalId;
      let canalDestinoId = canalBase;
      try {
        const topico = await criarTopico(canalBase, tituloFinal, 1440);
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
          montarSelectRole(),
          actionRow(btnDesistir, btnSalaVoz, btnDisponiveis),
        ],
      });

      // Guarda título + armas/quantidades como ping salvo (data, hora e tipo mudam toda vez).
      let avisoPing = "";
      try {
        await salvarPing(liderId, {
          slot: dados.slotPing ?? 1,
          titulo: dados.titulo,
          funcoes: Object.fromEntries(vagasFiltradas),
        });
        avisoPing = `\n📌 Salvo como seu ping ${dados.slotPing ?? 1} — no próximo /conteudo é só escolher.`;
      } catch (err) {
        console.error("Erro ao salvar ping:", err);
      }

      await apagarEstadoWizard(liderId);

      await editarRespostaOriginal(applicationId, token, {
        content: `✅ **Pronto!** PT postada em <#${canalBase}>.${avisoPing}`,
        components: [],
      });
    },
  };
}
