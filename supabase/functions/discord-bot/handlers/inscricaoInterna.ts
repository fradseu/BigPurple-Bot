// inscricaoInterna.ts - Coloca uma pessoa na PT a pedido do bot de POOL (quando alguém
// aceita um convite). Roda aqui porque a mensagem da PT foi postada por ESTE bot, então
// só ele consegue editá-la. As regras de preenchimento estão em domain/preenchimento.ts.
//
//   preencher  : ocupa uma vaga livre da função da pessoa
//   agregar    : cria uma vaga nova (e a função entra no dropdown, se ainda não estava)
//   substituir : agregar + apaga uma vaga livre indicada (a função some do dropdown se
//                não sobrar nenhuma vaga dela)
import { buscarEmojisDaGuilda, buscarMensagem, editarMensagem } from "../discord/rest.ts";
import { formatarClasseParaMensagem, montarMapaEmojis } from "../domain/emoji.ts";
import { recalcularOpcoes, rotuloCompletoDaClasse } from "../domain/opcoesClasse.ts";
import {
  agregarVagaComJogador,
  FalhaPreenchimento,
  preencherVagaComJogador,
  ResultadoPreenchimento,
  substituirVagaComJogador,
} from "../domain/preenchimento.ts";
import {
  extrairLinhasVagasDoEmbed,
  extrairOpcoesDropdownInscricao,
  reconstruirEmbedVagas,
} from "./context.ts";
import { atualizarComponentesPainel } from "./ui.ts";

export type TipoInscricao = "preencher" | "agregar" | "substituir";

export type ResultadoInscricaoInterna =
  | { ok: true }
  | { ok: false; motivo: FalhaPreenchimento | "pt_nao_encontrada" };

export async function inscreverJogadorNaPT(params: {
  guildId: string;
  ptCanalId: string;
  ptMensagemId: string;
  userId: string;
  classe: string;
  tipo: TipoInscricao;
  classeRemover: string | null;
}): Promise<ResultadoInscricaoInterna> {
  const mensagem = await buscarMensagem(params.ptCanalId, params.ptMensagemId);
  if (!mensagem) return { ok: false, motivo: "pt_nao_encontrada" };

  const linhas = extrairLinhasVagasDoEmbed(mensagem);
  let opcoes = extrairOpcoesDropdownInscricao(mensagem);
  let resultado: ResultadoPreenchimento;

  if (params.tipo === "preencher") {
    resultado = preencherVagaComJogador(linhas, params.userId, params.classe);
  } else {
    // Vaga NOVA: precisa do nome da função no formato do painel (com o emoji do servidor).
    const mapa = montarMapaEmojis(await buscarEmojisDaGuilda(params.guildId));
    const rotulo = formatarClasseParaMensagem(rotuloCompletoDaClasse(params.classe) ?? params.classe, mapa);

    resultado = params.tipo === "agregar"
      ? agregarVagaComJogador(linhas, params.userId, rotulo)
      : params.classeRemover
      ? substituirVagaComJogador(linhas, params.userId, rotulo, params.classeRemover)
      : { ok: false, motivo: "vaga_a_remover_ocupada" }; // substituir sem a vaga a apagar: não adivinha

    // O dropdown acompanha a composição: função nova entra, função sem vagas sai.
    if (resultado.ok) opcoes = recalcularOpcoes(opcoes, resultado.linhas, mapa);
  }

  if (!resultado.ok) return resultado;

  const componentes = await atualizarComponentesPainel(
    resultado.linhas,
    mensagem.content,
    opcoes,
    params.guildId,
  );
  await editarMensagem(params.ptCanalId, mensagem.id, {
    embeds: [reconstruirEmbedVagas(mensagem, resultado.linhas)],
    components: componentes,
  });
  return { ok: true };
}

export interface PedidoPreencher {
  guildId: string;
  ptCanalId: string;
  ptMensagemId: string;
  userId: string;
  classe: string;
  tipo: TipoInscricao;
  classeRemover: string | null;
}

// Valida o JSON que chega na rota interna (nunca confiar no formato, nem de outra function).
export function validarPedidoPreencher(bruto: unknown): PedidoPreencher | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;
  const snowflake = (v: unknown) => typeof v === "string" && /^\d{15,25}$/.test(v) ? v : null;
  const texto = (v: unknown) => typeof v === "string" && v.trim() !== "" && v.length <= 60 ? v.trim() : null;

  const guildId = snowflake(o.guild_id);
  const ptCanalId = snowflake(o.pt_canal_id);
  const ptMensagemId = snowflake(o.pt_mensagem_id);
  const userId = snowflake(o.user_id);
  const classe = texto(o.classe);
  if (!guildId || !ptCanalId || !ptMensagemId || !userId || !classe) return null;

  // Pedidos antigos não têm "tipo": continuam valendo como "preencher".
  const tipo = o.tipo === undefined ? "preencher" : o.tipo;
  if (tipo !== "preencher" && tipo !== "agregar" && tipo !== "substituir") return null;

  const classeRemover = texto(o.classe_remover);
  if (tipo === "substituir" && !classeRemover) return null;
  if (tipo !== "substituir" && o.classe_remover !== undefined && o.classe_remover !== null) return null;

  return { guildId, ptCanalId, ptMensagemId, userId, classe, tipo, classeRemover: tipo === "substituir" ? classeRemover : null };
}
