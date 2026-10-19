// client.ts - Cliente do Supabase pra uso DENTRO da Edge Function.
//
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente pelo
// Supabase em toda Edge Function publicada — não precisa cadastrar eles como
// secret manualmente (diferente do DISCORD_TOKEN, que é nosso e precisa ser
// configurado à mão).
import { createClient } from "@supabase/supabase-js";

// Tipo mínimo do schema (só a tabela que usamos) — sem isso o supabase-js
// tipa toda query como `never`, já que ele não tem como adivinhar as colunas.
export interface Database {
  public: {
    Tables: {
      pt_wizard_state: {
        Row: { lider_id: string; dados: Record<string, unknown>; atualizado_em: string };
        Insert: { lider_id: string; dados: Record<string, unknown>; atualizado_em?: string };
        Update: { lider_id?: string; dados?: Record<string, unknown>; atualizado_em?: string };
        Relationships: [];
      };
      // Tabelas do POOL (bot de pool): este bot só LÊ — quem escreve é o bot de pool.
      pool_config: {
        Row: { guild_id: string; canal_pool_id: string | null; areas_canais: Record<string, string> };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      pool_disponibilidades: {
        Row: {
          id: string;
          guild_id: string;
          user_id: string;
          pseudonimo: string;
          areas: string[];
          atividades: string[];
          classes: string[];
          tier: string;
          expira_em: string;
          status: string;
          criado_em: string;
        };
        Insert: never;
        Update: never;
        Relationships: [];
      };
      pool_convites: {
        Row: { id: string; disponibilidade_id: string; pt_mensagem_id: string; status: string; expira_em: string };
        Insert: never;
        Update: never;
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
    auth: { persistSession: false },
  });

  return clienteSingleton;
}
