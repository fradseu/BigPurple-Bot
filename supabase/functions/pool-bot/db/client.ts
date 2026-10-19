// client.ts - Cliente do Supabase pra uso DENTRO da Edge Function.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente.
import { createClient } from "@supabase/supabase-js";

export type StatusDisponibilidade = "ativa" | "cancelada" | "expirada" | "aceita";

// `type` (e não `interface`) de propósito: o supabase-js exige tipos com
// assinatura de índice implícita; com `interface` toda query vira `never`.
export type PoolConfigRow = {
  guild_id: string;
  canal_pool_id: string | null;
  atualizado_em: string;
};

export type CaixaRow = {
  guild_id: string;
  user_id: string;
  thread_id: string;
  controle_mensagem_id: string | null;
  pseudonimo: string;
  criado_em: string;
};

export type DisponibilidadeRow = {
  id: string;
  guild_id: string;
  user_id: string;
  pseudonimo: string;
  atividades: string[];
  classes: string[];
  tier: string;
  expira_em: string;
  status: StatusDisponibilidade;
  criado_em: string;
};

export type WizardRow = {
  guild_id: string;
  user_id: string;
  dados: Record<string, unknown>;
  atualizado_em: string;
};

export interface Database {
  public: {
    Tables: {
      pool_config: {
        Row: PoolConfigRow;
        Insert: Pick<PoolConfigRow, "guild_id"> & Partial<PoolConfigRow>;
        Update: Partial<PoolConfigRow>;
        Relationships: [];
      };
      pool_caixas: {
        Row: CaixaRow;
        Insert: Omit<CaixaRow, "criado_em" | "controle_mensagem_id"> & Partial<CaixaRow>;
        Update: Partial<CaixaRow>;
        Relationships: [];
      };
      pool_disponibilidades: {
        Row: DisponibilidadeRow;
        Insert: Omit<DisponibilidadeRow, "id" | "status" | "criado_em"> & Partial<DisponibilidadeRow>;
        Update: Partial<DisponibilidadeRow>;
        Relationships: [];
      };
      pool_wizard: {
        Row: WizardRow;
        Insert: Omit<WizardRow, "atualizado_em"> & Partial<WizardRow>;
        Update: Partial<WizardRow>;
        Relationships: [];
      };
    };
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}

let clienteSingleton: ReturnType<typeof createClient<Database>> | null = null;

export function obterClienteSupabase() {
  if (clienteSingleton) return clienteSingleton;

  const url = Deno.env.get("SUPABASE_URL");
  const chave = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!url || !chave) {
    throw new Error(
      "SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY ausentes — isso só acontece rodando fora do ambiente do Supabase.",
    );
  }

  clienteSingleton = createClient<Database>(url, chave, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return clienteSingleton;
}
