// pool.ts - Leitura/escrita das tabelas do pool.
import {
  CaixaRow,
  ConviteRow,
  DisponibilidadeRow,
  obterClienteSupabase,
  PoolConfigRow,
  StatusConvite,
  WizardRow,
} from "./client.ts";
import { avaliarEnvio, AvaliacaoEnvio, EstadoEnvios } from "../domain/convite.ts";

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

export async function obterDisponibilidadePorId(id: string): Promise<DisponibilidadeRow | null> {
  const { data, error } = await db().from("pool_disponibilidades").select().eq("id", id).maybeSingle();
  if (error) throw new Error(`Erro ao ler disponibilidade: ${error.message}`);
  return data;
}

// Quem aceitou um convite sai do catálogo (status 'aceita').
export async function marcarDisponibilidadeAceita(id: string): Promise<void> {
  const { error } = await db().from("pool_disponibilidades").update({ status: "aceita" }).eq("id", id).eq("status", "ativa");
  if (error) throw new Error(`Erro ao marcar disponibilidade como aceita: ${error.message}`);
}

// --------------------------------------------------------------- convites

export type ResultadoCriarConvite =
  | { tipo: "criado"; convite: ConviteRow }
  | { tipo: "ja_convidado" }; // o índice único barrou: já existe convite pendente pra essa PT

export async function criarConvite(
  dados: Pick<
    ConviteRow,
    | "guild_id"
    | "disponibilidade_id"
    | "candidato_user_id"
    | "lider_user_id"
    | "pt_canal_id"
    | "pt_mensagem_id"
    | "classe"
    | "tipo"
    | "classe_remover"
    | "thread_id"
    | "expira_em"
  >,
): Promise<ResultadoCriarConvite> {
  const { data, error } = await db().from("pool_convites").insert(dados).select().single();
  if (error) {
    if (error.code === "23505") return { tipo: "ja_convidado" };
    throw new Error(`Erro ao criar convite: ${error.message}`);
  }
  return { tipo: "criado", convite: data };
}

export async function registrarMensagemDoConvite(id: string, mensagemId: string): Promise<void> {
  const { error } = await db().from("pool_convites").update({ mensagem_id: mensagemId }).eq("id", id);
  if (error) throw new Error(`Erro ao registrar mensagem do convite: ${error.message}`);
}

export async function contarConvitesPendentesDaPT(ptMensagemId: string): Promise<number> {
  const { count, error } = await db()
    .from("pool_convites")
    .select("id", { count: "exact", head: true })
    .eq("pt_mensagem_id", ptMensagemId)
    .eq("status", "pendente")
    .gt("expira_em", new Date().toISOString());
  if (error) throw new Error(`Erro ao contar convites pendentes: ${error.message}`);
  return count ?? 0;
}

// Responde um convite de forma ATÔMICA: só muda se ainda estiver pendente, não vencido
// e for DESTA pessoa. Duas respostas ao mesmo tempo (ou um duplo clique) nunca passam
// as duas — a segunda recebe null.
export async function responderConvite(
  id: string,
  candidatoUserId: string,
  novoStatus: Extract<StatusConvite, "aceito" | "recusado">,
): Promise<ConviteRow | null> {
  const { data, error } = await db()
    .from("pool_convites")
    .update({ status: novoStatus })
    .eq("id", id)
    .eq("candidato_user_id", candidatoUserId)
    .eq("status", "pendente")
    .gt("expira_em", new Date().toISOString())
    .select()
    .maybeSingle();
  if (error) throw new Error(`Erro ao responder convite: ${error.message}`);
  return data;
}

export async function definirStatusConvite(id: string, status: StatusConvite): Promise<void> {
  const { error } = await db().from("pool_convites").update({ status }).eq("id", id);
  if (error) throw new Error(`Erro ao atualizar convite: ${error.message}`);
}

// Cancela os OUTROS convites pendentes de quem acabou de aceitar um (devolve pra apagar as mensagens).
export async function cancelarOutrosConvites(disponibilidadeId: string, exceto: string): Promise<ConviteRow[]> {
  const { data, error } = await db()
    .from("pool_convites")
    .update({ status: "cancelado" })
    .eq("disponibilidade_id", disponibilidadeId)
    .eq("status", "pendente")
    .neq("id", exceto)
    .select();
  if (error) throw new Error(`Erro ao cancelar outros convites: ${error.message}`);
  return data ?? [];
}

// Cancela os convites pendentes de uma disponibilidade (ex: a pessoa saiu da lista).
export async function cancelarConvitesDaDisponibilidade(disponibilidadeId: string): Promise<ConviteRow[]> {
  const { data, error } = await db()
    .from("pool_convites")
    .update({ status: "cancelado" })
    .eq("disponibilidade_id", disponibilidadeId)
    .eq("status", "pendente")
    .select();
  if (error) throw new Error(`Erro ao cancelar convites da disponibilidade: ${error.message}`);
  return data ?? [];
}

export async function expirarConvitesVencidos(agora: Date): Promise<ConviteRow[]> {
  const { data, error } = await db()
    .from("pool_convites")
    .update({ status: "expirado" })
    .eq("status", "pendente")
    .lte("expira_em", agora.toISOString())
    .select();
  if (error) throw new Error(`Erro ao expirar convites: ${error.message}`);
  return data ?? [];
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

// ----------------------------------------------------- anti-flood por PT


export type ResultadoReserva =
  | { ok: true; anterior: EstadoEnvios | null }
  | { ok: false; bloqueio: Exclude<AvaliacaoEnvio, { permitido: true }> };

// Reserva UMA tentativa de envio pra PT, respeitando intervalo e máximo. Compare-and-swap:
// o UPDATE só vale se ninguém mexeu na linha desde a leitura, então dois cliques
// simultâneos nunca passam os dois (o segundo recebe "espere").
export async function reservarEnvio(guildId: string, ptMensagemId: string, agoraMs: number): Promise<ResultadoReserva> {
  const { data: atual, error } = await db().from("pool_envios").select().eq("pt_mensagem_id", ptMensagemId).maybeSingle();
  if (error) throw new Error(`Erro ao ler envios da PT: ${error.message}`);

  const estado: EstadoEnvios | null = atual
    ? { tentativas: atual.tentativas, ultimoEnvioMs: Date.parse(atual.ultimo_envio) }
    : null;
  const avaliacao = avaliarEnvio(estado, agoraMs);
  if (!avaliacao.permitido) return { ok: false, bloqueio: avaliacao };

  const agoraIso = new Date(agoraMs).toISOString();
  if (!atual) {
    const { error: erroInsert } = await db()
      .from("pool_envios")
      .insert({ pt_mensagem_id: ptMensagemId, guild_id: guildId, tentativas: 1, ultimo_envio: agoraIso });
    if (erroInsert) {
      // 23505: outra requisição criou a linha primeiro — essa perdeu a corrida.
      if (erroInsert.code === "23505") {
        return { ok: false, bloqueio: { permitido: false, motivo: "espere", esperaSeg: 1, tentativas: 1 } };
      }
      throw new Error(`Erro ao registrar envio: ${erroInsert.message}`);
    }
    return { ok: true, anterior: null };
  }

  const { data: atualizada, error: erroUpdate } = await db()
    .from("pool_envios")
    .update({ tentativas: atual.tentativas + 1, ultimo_envio: agoraIso })
    .eq("pt_mensagem_id", ptMensagemId)
    .eq("tentativas", atual.tentativas)
    .eq("ultimo_envio", atual.ultimo_envio)
    .select();
  if (erroUpdate) throw new Error(`Erro ao registrar envio: ${erroUpdate.message}`);
  if (!atualizada || atualizada.length === 0) {
    return { ok: false, bloqueio: { permitido: false, motivo: "espere", esperaSeg: 1, tentativas: atual.tentativas } };
  }
  return { ok: true, anterior: estado };
}

// Se NENHUM convite chegou a ser enviado (todos indisponíveis, por exemplo), a tentativa
// não deve ser queimada: devolve o estado de antes.
export async function devolverEnvio(ptMensagemId: string, anterior: EstadoEnvios | null): Promise<void> {
  if (!anterior) {
    await db().from("pool_envios").delete().eq("pt_mensagem_id", ptMensagemId);
    return;
  }
  await db()
    .from("pool_envios")
    .update({ tentativas: anterior.tentativas, ultimo_envio: new Date(anterior.ultimoEnvioMs).toISOString() })
    .eq("pt_mensagem_id", ptMensagemId);
}

// ----------------------------------------------- sincronização de caixas

// Servidores onde o Pool já foi configurado (têm um canal do pool definido).
export async function listarServidoresComPool(): Promise<Array<{ guildId: string; canalPoolId: string }>> {
  const { data, error } = await db().from("pool_config").select("guild_id, canal_pool_id");
  if (error) throw new Error(`Erro ao listar servidores do pool: ${error.message}`);
  return (data ?? [])
    .filter((c): c is { guild_id: string; canal_pool_id: string } => Boolean(c.canal_pool_id))
    .map((c) => ({ guildId: c.guild_id, canalPoolId: c.canal_pool_id }));
}

// Cargo de Membro do servidor (configurado no recrutamento com /recrutamento-config membro).
export async function obterCargoMembro(guildId: string): Promise<string | null> {
  const { data, error } = await db()
    .from("recrutamento_config")
    .select("guild_id, cargo_membro_id")
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) throw new Error(`Erro ao ler o cargo de Membro: ${error.message}`);
  return data?.cargo_membro_id ?? null;
}

export async function listarUsuariosComCaixa(guildId: string): Promise<Set<string>> {
  const { data, error } = await db().from("pool_caixas").select("user_id").eq("guild_id", guildId);
  if (error) throw new Error(`Erro ao listar caixas: ${error.message}`);
  return new Set((data ?? []).map((c) => c.user_id));
}
