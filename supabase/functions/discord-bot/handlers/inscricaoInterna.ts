// inscricaoInterna.ts - Preenche uma vaga da PT a pedido do bot de POOL (quando alguém
// aceita um convite). Roda aqui porque a mensagem da PT foi postada por ESTE bot, então
// só ele consegue editá-la. A regra de preenchimento está em domain/preenchimento.ts.
import { buscarMensagem, editarMensagem } from "../discord/rest.ts";
import { FalhaPreenchimento, preencherVagaComJogador } from "../domain/preenchimento.ts";
import {
  extrairLinhasVagasDoEmbed,
  extrairOpcoesDropdownInscricao,
  reconstruirEmbedVagas,
} from "./context.ts";
import { atualizarComponentesPainel } from "./ui.ts";

export type ResultadoInscricaoInterna =
  | { ok: true }
  | { ok: false; motivo: FalhaPreenchimento | "pt_nao_encontrada" };

export async function inscreverJogadorNaPT(params: {
  guildId: string;
  ptCanalId: string;
  ptMensagemId: string;
  userId: string;
  classe: string;
}): Promise<ResultadoInscricaoInterna> {
  const mensagem = await buscarMensagem(params.ptCanalId, params.ptMensagemId);
  if (!mensagem) return { ok: false, motivo: "pt_nao_encontrada" };

  const resultado = preencherVagaComJogador(
    extrairLinhasVagasDoEmbed(mensagem),
    params.userId,
    params.classe,
  );
  if (!resultado.ok) return resultado;

  const componentes = await atualizarComponentesPainel(
    resultado.linhas,
    mensagem.content,
    extrairOpcoesDropdownInscricao(mensagem),
    params.guildId,
  );

  await editarMensagem(params.ptCanalId, mensagem.id, {
    embeds: [reconstruirEmbedVagas(mensagem, resultado.linhas)],
    components: componentes,
  });
  return { ok: true };
}

// Valida o JSON que chega na rota interna (nunca confiar no formato, nem de outra function).
export function validarPedidoPreencher(bruto: unknown): {
  guildId: string;
  ptCanalId: string;
  ptMensagemId: string;
  userId: string;
  classe: string;
} | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;
  const snowflake = (v: unknown) => typeof v === "string" && /^\d{15,25}$/.test(v) ? v : null;
  const guildId = snowflake(o.guild_id);
  const ptCanalId = snowflake(o.pt_canal_id);
  const ptMensagemId = snowflake(o.pt_mensagem_id);
  const userId = snowflake(o.user_id);
  const classe = typeof o.classe === "string" && o.classe.trim() !== "" && o.classe.length <= 60
    ? o.classe.trim()
    : null;
  if (!guildId || !ptCanalId || !ptMensagemId || !userId || !classe) return null;
  return { guildId, ptCanalId, ptMensagemId, userId, classe };
}
