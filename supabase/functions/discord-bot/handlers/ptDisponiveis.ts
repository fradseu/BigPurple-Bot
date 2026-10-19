// ptDisponiveis.ts - O líder da PT vê o catálogo ANÔNIMO do Pool e convida.
//
//   [🔎 Ver disponíveis] -> duas listas, filtradas pela PT (área do canal de ping + atividade):
//       🟢 vaga aberta   : a classe da pessoa tem vaga livre -> convite normal, ou EM MASSA
//       🟡 outras classes: sem vaga livre -> 1 por 1, AGREGANDO uma vaga nova ou SUBSTITUINDO
//                          (cria a vaga dela e apaga uma vaga livre que o líder indicar)
//
// Anti-flood (por PT, aplicado no Pool): 1 envio a cada 2 minutos, no máximo 5 tentativas.
// Tudo que pode demorar (banco, Discord) roda depois do "pensando..." pra não estourar os 3s.
// O nick de quem aceita só aparece quando o painel da PT é atualizado.
import { deferredReply, deferredUpdate, reply, updateMessage } from "../discord/responses.ts";
import { buscarCanal, buscarMensagem, editarRespostaOriginal, MensagemDiscord } from "../discord/rest.ts";
import { DiscordInteraction, getInteractionUserId } from "../discord/types.ts";
import {
  areaDaPT,
  extrairAtividadesDaPT,
  extrairDetalhesDaPT,
  lerValorOpcao,
  montarCatalogo,
  montarOutrasClasses,
  montarTelaCatalogo,
  montarTelaConfirmacao,
  montarTelaConfirmarSubstituir,
  montarTelaEscolhaOutra,
  montarTelaMassa,
  montarTelaMenuSubstituir,
  OpcaoCatalogo,
  resumirEnvio,
  selecionarParaMassa,
  usuariosNaPT,
  vagaContinuaAberta,
  VagaAberta,
  vagasAbertas,
} from "../domain/catalogo.ts";
import { classeDoIndice, indiceDaClasse } from "../domain/opcoesClasse.ts";
import { MAX_VAGAS_PT } from "../domain/preenchimento.ts";
import { contarVagas } from "../domain/vagas.ts";
import { listarConvitesPendentesDaPT, listarDisponiveis, obterConfigPool } from "../db/pool.ts";
import { extrairLiderIdDoCriador, extrairLinhasVagasDoEmbed, HandlerResult } from "./context.ts";
import { convidarNoPool, ItemConvite } from "./poolBot.ts";

const SO_LIDER = "❌ Apenas o Líder da PT pode ver os disponíveis e convidar!";

type Payload = Parameters<typeof editarRespostaOriginal>[2];

// ------------------------------------------------------------------ catálogo

interface ContextoCatalogo {
  guildId: string;
  canalId: string;
  pt: MensagemDiscord;
  liderId: string;
  linhas: string[];
  abertas: VagaAberta[];
  comVagaAberta: OpcaoCatalogo[];
  outras: OpcaoCatalogo[];
}

type Carregado = { ok: true; ctx: ContextoCatalogo } | { ok: false; aviso: string };

// Lê a PT, descobre a área, busca os disponíveis e separa em "vaga aberta" e "outras classes".
async function carregarCatalogo(interaction: DiscordInteraction, ptMsgId: string): Promise<Carregado> {
  const guildId = interaction.guild_id;
  const canalId = interaction.channel_id;
  if (!guildId || !canalId) return { ok: false, aviso: "Isso só funciona dentro de um servidor." };

  const config = await obterConfigPool(guildId);
  if (!config) {
    return { ok: false, aviso: "O Pool ainda não foi configurado neste servidor. Peça a um administrador usar `/pool-painel`." };
  }

  const pt = await buscarMensagem(canalId, ptMsgId);
  if (!pt) return { ok: false, aviso: "Não encontrei o painel dessa PT (ela foi apagada?)." };

  // A PT mora num tópico do canal de ping; o PAI é que diz a área (PVE/PVP/FAC/Avalon).
  const pai = interaction.channel?.parent_id ?? (await buscarCanal(canalId)).parent_id;
  const area = areaDaPT([pai, canalId], config.areasCanais);
  if (!area) {
    return { ok: false, aviso: "Esse canal de ping ainda não está ligado a uma área do Pool. Peça a um administrador." };
  }

  const linhas = extrairLinhasVagasDoEmbed(pt);
  const abertas = vagasAbertas(linhas);
  const liderId = extrairLiderIdDoCriador(pt.content);

  const [candidatos, jaConvidados] = await Promise.all([
    listarDisponiveis({ guildId, area, atividades: extrairAtividadesDaPT(pt.content) }),
    listarConvitesPendentesDaPT(ptMsgId),
  ]);

  // O líder NÃO é excluído só por ser líder: quem sai do catálogo é quem já está inscrito na
  // PT (naPT, abaixo). Se o líder não está em nenhuma vaga, ele pode ser convidado como qualquer um.
  const comum = {
    candidatos,
    abertas,
    liderId: "",
    naPT: usuariosNaPT(linhas),
    jaConvidados,
    agoraMs: Date.now(),
  };

  return {
    ok: true,
    ctx: {
      guildId,
      canalId,
      pt,
      liderId,
      linhas,
      abertas,
      comVagaAberta: montarCatalogo(comum),
      outras: montarOutrasClasses(comum),
    },
  };
}

async function montarCatalogoDaPT(interaction: DiscordInteraction, ptMsgId: string): Promise<Payload> {
  const r = await carregarCatalogo(interaction, ptMsgId);
  if (!r.ok) return montarTelaCatalogo({ abertas: [], outras: [], ptMsgId, aviso: r.aviso });

  const { ctx } = r;
  return montarTelaCatalogo({
    abertas: ctx.comVagaAberta,
    outras: ctx.outras,
    ptMsgId,
    qtdMassa: selecionarParaMassa(ctx.comVagaAberta).length,
    aviso: ctx.abertas.length === 0
      ? "Todas as vagas dessa PT estão preenchidas — só dá pra convidar **criando uma vaga nova** (agregar)."
      : undefined,
  });
}

// Botão "🔎 Ver disponíveis" no painel da PT (só o líder).
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
      await editarRespostaOriginal(applicationId, token, await montarCatalogoDaPT(interaction, pt.id));
    },
  };
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
        await editarRespostaOriginal(
          applicationId,
          token,
          montarTelaCatalogo({ abertas: [], outras: [], ptMsgId, aviso: SO_LIDER }),
        );
        return;
      }
      await editarRespostaOriginal(applicationId, token, await montarCatalogoDaPT(interaction, ptMsgId));
    },
  };
}

// ------------------------------------------- 🟢 vaga aberta: um convite normal

// Escolheu alguém na lista -> tela de confirmação (sem banco: tudo vem no valor da opção).
export function handleSelecionarCandidato(interaction: DiscordInteraction, ptMsgId: string): HandlerResult {
  const escolha = lerValorOpcao(interaction.data?.values?.[0] ?? "");
  if (!escolha) {
    return { immediate: reply("⚠️ Opção inválida. Abra a lista de novo.", { ephemeral: true }) };
  }
  const tela = montarTelaConfirmacao(escolha.codigo, escolha.classe, escolha.dispId, ptMsgId);
  return { immediate: updateMessage(tela.content, tela.components, tela.embeds) };
}

export function handleConfirmarConvite(
  interaction: DiscordInteraction,
  dados: { dispId: string; ptMsgId: string; classe: string },
): HandlerResult {
  return enviarConvites(interaction, dados.ptMsgId, [
    { disponibilidade_id: dados.dispId, classe: dados.classe, tipo: "preencher" },
  ]);
}

// ------------------------------------------- 🟡 outras classes: agregar ou substituir

// Escolheu alguém de OUTRA classe -> pergunta: agregar vaga ou substituir uma vaga livre?
export function handleSelecionarOutra(interaction: DiscordInteraction, ptMsgId: string): HandlerResult {
  const escolha = lerValorOpcao(interaction.data?.values?.[0] ?? "");
  const ci = escolha ? indiceDaClasse(escolha.classe) : -1;
  if (!escolha || ci < 0) {
    return { immediate: reply("⚠️ Opção inválida. Abra a lista de novo.", { ephemeral: true }) };
  }
  const tela = montarTelaEscolhaOutra(escolha.codigo, escolha.classe, escolha.dispId, ptMsgId, ci);
  return { immediate: updateMessage(tela.content, tela.components, tela.embeds) };
}

export function handleEnviarAgregar(
  interaction: DiscordInteraction,
  dados: { dispId: string; ptMsgId: string; ci: number },
): HandlerResult {
  const classe = classeDoIndice(dados.ci);
  if (!classe) return { immediate: reply("⚠️ Classe inválida. Abra a lista de novo.", { ephemeral: true }) };
  return enviarConvites(interaction, dados.ptMsgId, [
    { disponibilidade_id: dados.dispId, classe, tipo: "agregar" },
  ]);
}

// "Substituir uma vaga livre": mostra QUAIS vagas livres dá pra apagar (lidas da PT agora).
export function handleMenuSubstituir(
  interaction: DiscordInteraction,
  dados: { dispId: string; ptMsgId: string; ci: number; codigo: string },
): HandlerResult {
  const applicationId = interaction.application_id;
  const token = interaction.token;
  const classe = classeDoIndice(dados.ci);

  return {
    immediate: deferredUpdate(),
    background: async () => {
      const canalId = interaction.channel_id;
      const pt = canalId ? await buscarMensagem(canalId, dados.ptMsgId) : null;
      if (!pt || !classe || getInteractionUserId(interaction) !== extrairLiderIdDoCriador(pt.content)) {
        await editarRespostaOriginal(
          applicationId,
          token,
          montarTelaCatalogo({ abertas: [], outras: [], ptMsgId: dados.ptMsgId, aviso: pt ? SO_LIDER : "Não encontrei o painel dessa PT." }),
        );
        return;
      }

      const livres = vagasAbertas(extrairLinhasVagasDoEmbed(pt))
        .map((v) => ({ rotulo: v.rotulo, indice: indiceDaClasse(v.rotulo) }))
        .filter((v) => v.indice >= 0);

      await editarRespostaOriginal(
        applicationId,
        token,
        montarTelaMenuSubstituir({ ...dados, classe, livres }),
      );
    },
  };
}

// Escolheu qual vaga livre apagar -> confirmação final (sem banco: tudo vem nos IDs).
export function handleSelecionarRemocao(
  interaction: DiscordInteraction,
  dados: { dispId: string; ptMsgId: string; ci: number; codigo: string },
): HandlerResult {
  const cr = Number(interaction.data?.values?.[0]);
  const classe = classeDoIndice(dados.ci);
  const remover = Number.isInteger(cr) ? classeDoIndice(cr) : null;
  if (!classe || !remover) {
    return { immediate: reply("⚠️ Opção inválida. Abra a lista de novo.", { ephemeral: true }) };
  }
  const tela = montarTelaConfirmarSubstituir({ ...dados, classe, remover, cr });
  return { immediate: updateMessage(tela.content, tela.components, tela.embeds) };
}

export function handleEnviarSubstituir(
  interaction: DiscordInteraction,
  dados: { dispId: string; ptMsgId: string; ci: number; cr: number },
): HandlerResult {
  const classe = classeDoIndice(dados.ci);
  const remover = classeDoIndice(dados.cr);
  if (!classe || !remover) return { immediate: reply("⚠️ Classe inválida. Abra a lista de novo.", { ephemeral: true }) };
  return enviarConvites(interaction, dados.ptMsgId, [
    { disponibilidade_id: dados.dispId, classe, tipo: "substituir", classe_remover: remover },
  ]);
}

// ------------------------------------------- 📨 em massa (só quem tem a vaga aberta)

// "Convidar todos": mostra QUEM vai receber e quanto isso custa do limite, antes de gastar a tentativa.
export function handleMassa(interaction: DiscordInteraction, ptMsgId: string): HandlerResult {
  const applicationId = interaction.application_id;
  const token = interaction.token;
  return {
    immediate: deferredUpdate(),
    background: async () => {
      const r = await carregarCatalogo(interaction, ptMsgId);
      if (!r.ok || getInteractionUserId(interaction) !== r.ctx.liderId) {
        await editarRespostaOriginal(
          applicationId,
          token,
          montarTelaCatalogo({ abertas: [], outras: [], ptMsgId, aviso: r.ok ? SO_LIDER : r.aviso }),
        );
        return;
      }
      const alvos = selecionarParaMassa(r.ctx.comVagaAberta);
      await editarRespostaOriginal(
        applicationId,
        token,
        alvos.length === 0
          ? montarTelaCatalogo({ abertas: [], outras: r.ctx.outras, ptMsgId, aviso: "Ninguém com vaga aberta disponível agora." })
          : montarTelaMassa(alvos.map((a) => ({ codigo: a.codigo, classe: a.classe })), ptMsgId),
      );
    },
  };
}

// Confirmou o envio em massa: refaz a seleção AGORA (a lista pode ter mudado) e envia.
export function handleEnviarMassa(interaction: DiscordInteraction, ptMsgId: string): HandlerResult {
  return enviarConvites(interaction, ptMsgId, "massa");
}

// ------------------------------------------------------------------ envio

// Núcleo dos envios. Confirma o clique, reconfere TUDO no servidor (o líder é mesmo o líder;
// a vaga ainda está livre / a vaga a apagar ainda existe) e pede o envio ao Pool, que aplica
// o limite anti-flood. `itens === "massa"` recalcula a seleção em massa neste momento.
function enviarConvites(
  interaction: DiscordInteraction,
  ptMsgId: string,
  itensOuMassa: ItemConvite[] | "massa",
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

      const pt = await buscarMensagem(canalId, ptMsgId);
      if (!pt) return await terminar("Não encontrei o painel dessa PT (ela foi apagada?).");
      if (extrairLiderIdDoCriador(pt.content) !== liderId) return await terminar(SO_LIDER);

      const linhas = extrairLinhasVagasDoEmbed(pt);

      let itens: ItemConvite[];
      if (itensOuMassa === "massa") {
        const r = await carregarCatalogo(interaction, ptMsgId);
        if (!r.ok) return await terminar(r.aviso);
        itens = selecionarParaMassa(r.ctx.comVagaAberta).map((o) => ({
          disponibilidade_id: o.disponibilidadeId,
          classe: o.classe,
          tipo: "preencher" as const,
        }));
        if (itens.length === 0) return await terminar("Ninguém com vaga aberta disponível agora.");
      } else {
        // Revalida cada item contra a PT de AGORA: o catálogo foi montado antes, e nesse meio
        // tempo vagas podem ter sido ocupadas. Melhor avisar o líder do que a pessoa aceitar e
        // não entrar.
        itens = [];
        for (const item of itensOuMassa) {
          if (item.tipo === "preencher" && !vagaContinuaAberta(linhas, item.classe)) {
            return await terminar(`😕 A vaga de **${item.classe}** não está mais livre nessa PT. Volte à lista e escolha outra.`);
          }
          if (item.tipo === "substituir" && !vagaContinuaAberta(linhas, item.classe_remover ?? "")) {
            return await terminar(
              `😕 A vaga livre de **${item.classe_remover}** que você ia apagar não está mais livre. Volte à lista e escolha de novo.`,
            );
          }
          if (item.tipo === "agregar" && contarVagas(linhas).total >= MAX_VAGAS_PT) {
            return await terminar("😕 Essa PT já está no limite de vagas — não dá pra agregar mais.");
          }
          itens.push(item);
        }
      }

      const resposta = await convidarNoPool({
        guild_id: guildId,
        pt_canal_id: canalId,
        pt_mensagem_id: ptMsgId,
        pt_detalhes: extrairDetalhesDaPT(pt.content),
        lider_user_id: liderId,
        itens,
      });

      await terminar(resumirEnvio(resposta));
    },
  };
}
