// candidaturas.ts - Leitura/escrita da tabela recrutamento_candidaturas.
import { CandidaturaRow, obterClienteSupabase, StatusCandidatura } from "./client.ts";

const TABELA = "recrutamento_candidaturas";

export interface NovaCandidatura {
  guild_id: string;
  discord_user_id: string;
  discord_username: string;
  nickname: string;
  fama_declarada: string;
  fama_declarada_num: number | null;
  como_conheceu: string;
  albion_player_id: string | null;
  dossie: Record<string, unknown> | null;
}

// Lançado quando o índice único "uma pendente por usuário" barra a inserção.
export class CandidaturaDuplicadaError extends Error {
  constructor() {
    super("Já existe uma candidatura pendente para esse usuário");
  }
}

export async function criarCandidatura(dados: NovaCandidatura): Promise<CandidaturaRow> {
  const { data, error } = await obterClienteSupabase()
    .from(TABELA)
    .insert(dados)
    .select()
    .single();
  if (error) {
    if (error.code === "23505") throw new CandidaturaDuplicadaError(); // unique_violation
    throw new Error(`Erro ao salvar candidatura: ${error.message}`);
  }
  return data;
}

export async function obterCandidatura(id: string): Promise<CandidaturaRow | null> {
  const { data, error } = await obterClienteSupabase()
    .from(TABELA)
    .select()
    .eq("id", id)
    .maybeSingle();
  if (error) throw new Error(`Erro ao ler candidatura: ${error.message}`);
  return data;
}

export async function buscarPendenteDoUsuario(discordUserId: string): Promise<CandidaturaRow | null> {
  const { data, error } = await obterClienteSupabase()
    .from(TABELA)
    .select()
    .eq("discord_user_id", discordUserId)
    .eq("status", "pendente")
    .limit(1)
    .maybeSingle();
  if (error) throw new Error(`Erro ao verificar candidatura pendente: ${error.message}`);
  return data;
}

// Candidaturas anteriores já decididas (do mesmo Discord OU do mesmo personagem
// do Albion) — pra avisar o recrutador "esse jogador já tentou entrar antes".
export async function listarAnteriores(
  discordUserId: string,
  albionPlayerId: string | null,
): Promise<CandidaturaRow[]> {
  // Os valores entram numa string de filtro do PostgREST (vírgula/parêntese
  // quebrariam o filtro), então só aceita IDs "limpos" (snowflake / id do Albion).
  const idSeguro = (v: string) => /^[\w-]+$/.test(v);
  if (!idSeguro(discordUserId)) throw new Error("discord_user_id com formato inesperado");
  const filtro = albionPlayerId && idSeguro(albionPlayerId)
    ? `discord_user_id.eq.${discordUserId},albion_player_id.eq.${albionPlayerId}`
    : `discord_user_id.eq.${discordUserId}`;
  const { data, error } = await obterClienteSupabase()
    .from(TABELA)
    .select()
    .neq("status", "pendente")
    .or(filtro)
    .order("criado_em", { ascending: false })
    .limit(5);
  if (error) throw new Error(`Erro ao listar candidaturas anteriores: ${error.message}`);
  return data ?? [];
}

export async function registrarMensagem(
  id: string,
  canalId: string,
  mensagemId: string,
): Promise<void> {
  const { error } = await obterClienteSupabase()
    .from(TABELA)
    .update({ canal_id: canalId, mensagem_id: mensagemId })
    .eq("id", id);
  if (error) throw new Error(`Erro ao registrar mensagem da candidatura: ${error.message}`);
}

export async function apagarCandidatura(id: string): Promise<void> {
  await obterClienteSupabase().from(TABELA).delete().eq("id", id);
}

export async function atualizarDossie(
  id: string,
  albionPlayerId: string | null,
  dossie: Record<string, unknown>,
): Promise<void> {
  const { error } = await obterClienteSupabase()
    .from(TABELA)
    .update({ dossie, albion_player_id: albionPlayerId })
    .eq("id", id);
  if (error) throw new Error(`Erro ao atualizar dossiê: ${error.message}`);
}

// Só decide se ainda estiver pendente (WHERE status = 'pendente'): se dois
// recrutadores clicarem ao mesmo tempo, só o primeiro "ganha" e o segundo
// recebe null — evita aprovar e recusar a mesma candidatura.
export async function decidirCandidatura(
  id: string,
  status: Exclude<StatusCandidatura, "pendente">,
  decididoPor: string,
): Promise<CandidaturaRow | null> {
  const { data, error } = await obterClienteSupabase()
    .from(TABELA)
    .update({ status, decidido_por: decididoPor, decidido_em: new Date().toISOString() })
    .eq("id", id)
    .eq("status", "pendente")
    .select()
    .maybeSingle();
  if (error) throw new Error(`Erro ao registrar decisão: ${error.message}`);
  return data;
}
