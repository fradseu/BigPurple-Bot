// pool.ts - LEITURA das tabelas do Pool (quem escreve nelas é o bot de pool).
// Só traz as colunas necessárias. `user_id` é lido APENAS pra excluir quem já está na
// PT / é o líder — nunca vai pra nenhuma tela (veja domain/catalogo.ts).
import { CandidatoBruto } from "../domain/catalogo.ts";
import { codigosParaPT } from "../domain/codigoAnonimo.ts";
import { obterClienteSupabase } from "./client.ts";

export async function obterConfigPool(
  guildId: string,
): Promise<{ areasCanais: Record<string, string> } | null> {
  const { data, error } = await obterClienteSupabase()
    .from("pool_config")
    .select("guild_id, canal_pool_id, areas_canais")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) throw new Error(`Erro ao ler config do pool: ${error.message}`);
  return data ? { areasCanais: data.areas_canais ?? {} } : null;
}

// Disponíveis AGORA (ativos e não vencidos) na área da PT. Se a PT declara atividades,
// só quem tem pelo menos uma delas em comum. O código que o líder vê é derivado da PT
// (veja domain/codigoAnonimo.ts); o código interno da caixa nem é lido aqui.
export async function listarDisponiveis(params: {
  guildId: string;
  ptMsgId: string;
  area: string;
  atividades: string[];
}): Promise<CandidatoBruto[]> {
  let consulta = obterClienteSupabase()
    .from("pool_disponibilidades")
    .select("id, user_id, areas, classes, tier, criado_em")
    .eq("guild_id", params.guildId)
    .eq("status", "ativa")
    .gt("expira_em", new Date().toISOString())
    .contains("areas", [params.area]);
  if (params.atividades.length > 0) consulta = consulta.overlaps("atividades", params.atividades);

  const { data, error } = await consulta;
  if (error) throw new Error(`Erro ao listar disponíveis: ${error.message}`);

  const codigos = await codigosParaPT((data ?? []).map((d) => d.id), params.ptMsgId);
  return (data ?? []).map((d) => ({
    id: d.id,
    userId: d.user_id,
    codigo: codigos.get(d.id)!,
    classes: d.classes,
    tier: d.tier,
    areas: d.areas,
    criadoEmMs: Date.parse(d.criado_em),
  }));
}

// Disponibilidades que já têm convite PENDENTE (não vencido) pra essa PT.
export async function listarConvitesPendentesDaPT(ptMensagemId: string): Promise<Set<string>> {
  const { data, error } = await obterClienteSupabase()
    .from("pool_convites")
    .select("disponibilidade_id")
    .eq("pt_mensagem_id", ptMensagemId)
    .eq("status", "pendente")
    .gt("expira_em", new Date().toISOString());
  if (error) throw new Error(`Erro ao listar convites pendentes: ${error.message}`);
  return new Set((data ?? []).map((c) => c.disponibilidade_id));
}
