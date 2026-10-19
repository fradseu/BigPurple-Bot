// pool.ts - Leitura/escrita das tabelas do pool.
import {
  CaixaRow,
  DisponibilidadeRow,
  obterClienteSupabase,
  PoolConfigRow,
  WizardRow,
} from "./client.ts";

const db = () => obterClienteSupabase();

// ---------------------------------------------------------------- config

export async function obterConfigPool(guildId: string): Promise<PoolConfigRow | null> {
  const { data, error } = await db().from("pool_config").select().eq("guild_id", guildId).maybeSingle();
  if (error) throw new Error(`Erro ao ler config do pool: ${error.message}`);
  return data;
}

export async function definirCanalPool(guildId: string, canalId: string): Promise<void> {
  const { error } = await db()
    .from("pool_config")
    .upsert(
      { guild_id: guildId, canal_pool_id: canalId, atualizado_em: new Date().toISOString() },
      { onConflict: "guild_id" },
    );
  if (error) throw new Error(`Erro ao salvar canal do pool: ${error.message}`);
}

// ---------------------------------------------------------------- caixas

export async function obterCaixa(guildId: string, userId: string): Promise<CaixaRow | null> {
  const { data, error } = await db()
    .from("pool_caixas")
    .select()
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Erro ao ler caixa: ${error.message}`);
  return data;
}

export type ResultadoCriarCaixa =
  | { tipo: "criada"; caixa: CaixaRow }
  | { tipo: "pseudonimo_em_uso" } // outro usuário já tem esse código: gerar outro
  | { tipo: "usuario_ja_tem_caixa" }; // corrida: outra requisição criou antes

export async function criarCaixa(
  dados: Pick<CaixaRow, "guild_id" | "user_id" | "thread_id" | "pseudonimo" | "controle_mensagem_id">,
): Promise<ResultadoCriarCaixa> {
  const { data, error } = await db().from("pool_caixas").insert(dados).select().single();
  if (error) {
    if (error.code === "23505") {
      // unique_violation: ou o pseudônimo repetiu, ou a pessoa já tinha caixa (chave primária)
      return error.message.includes("pseudonimo")
        ? { tipo: "pseudonimo_em_uso" }
        : { tipo: "usuario_ja_tem_caixa" };
    }
    throw new Error(`Erro ao salvar caixa: ${error.message}`);
  }
  return { tipo: "criada", caixa: data };
}

export async function atualizarControleDaCaixa(
  guildId: string,
  userId: string,
  mensagemId: string,
): Promise<void> {
  const { error } = await db()
    .from("pool_caixas")
    .update({ controle_mensagem_id: mensagemId })
    .eq("guild_id", guildId)
    .eq("user_id", userId);
  if (error) throw new Error(`Erro ao atualizar controle da caixa: ${error.message}`);
}

export async function apagarCaixa(guildId: string, userId: string): Promise<void> {
  await db().from("pool_caixas").delete().eq("guild_id", guildId).eq("user_id", userId);
}

// ---------------------------------------------------------------- wizard

export async function obterWizard(guildId: string, userId: string): Promise<WizardRow | null> {
  const { data, error } = await db()
    .from("pool_wizard")
    .select()
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .maybeSingle();
  if (error) throw new Error(`Erro ao ler formulário: ${error.message}`);
  return data;
}

export async function salvarWizard(
  guildId: string,
  userId: string,
  dados: Record<string, unknown>,
): Promise<void> {
  const { error } = await db()
    .from("pool_wizard")
    .upsert(
      { guild_id: guildId, user_id: userId, dados, atualizado_em: new Date().toISOString() },
      { onConflict: "guild_id,user_id" },
    );
  if (error) throw new Error(`Erro ao salvar formulário: ${error.message}`);
}

export async function apagarWizard(guildId: string, userId: string): Promise<void> {
  await db().from("pool_wizard").delete().eq("guild_id", guildId).eq("user_id", userId);
}

// ------------------------------------------------------- disponibilidades

export async function obterAtiva(guildId: string, userId: string): Promise<DisponibilidadeRow | null> {
  const { data, error } = await db()
    .from("pool_disponibilidades")
    .select()
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .eq("status", "ativa")
    .gt("expira_em", new Date().toISOString())
    .maybeSingle();
  if (error) throw new Error(`Erro ao ler disponibilidade: ${error.message}`);
  return data;
}

export async function cancelarAtiva(guildId: string, userId: string): Promise<boolean> {
  const { data, error } = await db()
    .from("pool_disponibilidades")
    .update({ status: "cancelada" })
    .eq("guild_id", guildId)
    .eq("user_id", userId)
    .eq("status", "ativa")
    .select();
  if (error) throw new Error(`Erro ao cancelar disponibilidade: ${error.message}`);
  return (data?.length ?? 0) > 0;
}

// Cancela a ativa anterior (se houver) e cria a nova — "Alterar" = substituir.
// O índice único parcial garante que nunca existam duas ativas da mesma pessoa.
export async function registrarDisponibilidade(
  dados: Pick<
    DisponibilidadeRow,
    "guild_id" | "user_id" | "pseudonimo" | "areas" | "atividades" | "classes" | "tier" | "expira_em"
  >,
): Promise<DisponibilidadeRow> {
  await cancelarAtiva(dados.guild_id, dados.user_id);
  const { data, error } = await db().from("pool_disponibilidades").insert(dados).select().single();
  if (error) throw new Error(`Erro ao registrar disponibilidade: ${error.message}`);
  return data;
}

// Marca como expiradas as ativas vencidas e devolve quais foram (a atualização
// com filtro é atômica: duas execuções simultâneas não pegam a mesma linha).
export async function expirarVencidas(agora: Date): Promise<DisponibilidadeRow[]> {
  const { data, error } = await db()
    .from("pool_disponibilidades")
    .update({ status: "expirada" })
    .eq("status", "ativa")
    .lte("expira_em", agora.toISOString())
    .select();
  if (error) throw new Error(`Erro ao expirar disponibilidades: ${error.message}`);
  return data ?? [];
}
