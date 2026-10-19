// config.ts (db) - Configuração do recrutamento por servidor.
import { ConfigPermissoes } from "../domain/permissoes.ts";
import { ConfigRow, obterClienteSupabase } from "./client.ts";

const TABELA = "recrutamento_config";

// Linha do banco -> o formato que as funções puras de permissão esperam.
export function permissoesDe(config: ConfigRow | null): ConfigPermissoes | null {
  if (!config) return null;
  return {
    cargoRecrutadorId: config.cargo_recrutador_id,
    autorizadosUsuarios: config.autorizados_usuarios,
    autorizadosCargos: config.autorizados_cargos,
  };
}

export async function obterConfig(guildId: string): Promise<ConfigRow | null> {
  const { data, error } = await obterClienteSupabase()
    .from(TABELA)
    .select()
    .eq("guild_id", guildId)
    .maybeSingle();
  if (error) throw new Error(`Erro ao ler configuração: ${error.message}`);
  return data;
}

// Grava só os campos passados (os outros ficam como estão). `upsert` cria a
// linha do servidor na primeira vez.
async function salvar(
  guildId: string,
  alteracoes: Partial<Omit<ConfigRow, "guild_id" | "atualizado_em">>,
  quem: string,
): Promise<ConfigRow> {
  const { data, error } = await obterClienteSupabase()
    .from(TABELA)
    .upsert(
      { guild_id: guildId, ...alteracoes, atualizado_por: quem, atualizado_em: new Date().toISOString() },
      { onConflict: "guild_id" },
    )
    .select()
    .single();
  if (error) throw new Error(`Erro ao salvar configuração: ${error.message}`);
  return data;
}

export function definirCanal(guildId: string, canalId: string, quem: string): Promise<ConfigRow> {
  return salvar(guildId, { canal_recrutadores_id: canalId }, quem);
}

export function definirCargoRecrutador(guildId: string, cargoId: string, quem: string): Promise<ConfigRow> {
  return salvar(guildId, { cargo_recrutador_id: cargoId }, quem);
}

export function definirCargoMembro(guildId: string, cargoId: string, quem: string): Promise<ConfigRow> {
  return salvar(guildId, { cargo_membro_id: cargoId }, quem);
}

export type TipoAutorizado = "usuario" | "cargo";

// Sem duplicar: autorizar duas vezes o mesmo alvo não cria entrada repetida.
export async function autorizar(
  guildId: string,
  tipo: TipoAutorizado,
  alvoId: string,
  quem: string,
): Promise<ConfigRow> {
  const atual = await obterConfig(guildId);
  if (tipo === "usuario") {
    const lista = new Set(atual?.autorizados_usuarios ?? []);
    lista.add(alvoId);
    return salvar(guildId, { autorizados_usuarios: [...lista] }, quem);
  }
  const lista = new Set(atual?.autorizados_cargos ?? []);
  lista.add(alvoId);
  return salvar(guildId, { autorizados_cargos: [...lista] }, quem);
}

export async function desautorizar(
  guildId: string,
  tipo: TipoAutorizado,
  alvoId: string,
  quem: string,
): Promise<ConfigRow> {
  const atual = await obterConfig(guildId);
  if (tipo === "usuario") {
    return salvar(
      guildId,
      { autorizados_usuarios: (atual?.autorizados_usuarios ?? []).filter((id) => id !== alvoId) },
      quem,
    );
  }
  return salvar(
    guildId,
    { autorizados_cargos: (atual?.autorizados_cargos ?? []).filter((id) => id !== alvoId) },
    quem,
  );
}
