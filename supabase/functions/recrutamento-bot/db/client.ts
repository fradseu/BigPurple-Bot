// client.ts - Cliente do Supabase pra uso DENTRO da Edge Function.
// SUPABASE_URL e SUPABASE_SERVICE_ROLE_KEY são injetados automaticamente.
import { createClient } from "@supabase/supabase-js";

export type StatusCandidatura = "pendente" | "aprovada" | "recusada";

// `type` (e não `interface`) de propósito: o supabase-js exige tipos com
// assinatura de índice implícita; com `interface` toda query vira `never`.
export type CandidaturaRow = {
  id: string;
  guild_id: string | null;
  discord_user_id: string;
  discord_username: string;
  nickname: string;
  fama_declarada: string;
  fama_declarada_num: number | null;
  como_conheceu: string;
  albion_player_id: string | null;
  dossie: Record<string, unknown> | null;
  status: StatusCandidatura;
  canal_id: string | null;
  mensagem_id: string | null;
  decidido_por: string | null;
  decidido_em: string | null;
  apelido_aplicado: string | null;
  criado_em: string;
};

export type ConfigRow = {
  guild_id: string;
  canal_recrutadores_id: string | null;
  cargo_recrutador_id: string | null;
  cargo_membro_id: string | null;
  autorizados_usuarios: string[];
  autorizados_cargos: string[];
  atualizado_por: string | null;
  atualizado_em: string;
};

// Colunas que o banco preenche sozinho ou que só existem depois (decisão/mensagem):
// não são obrigatórias ao criar a candidatura.
type CamposAutomaticos =
  | "id"
  | "status"
  | "decidido_por"
  | "decidido_em"
  | "criado_em"
  | "canal_id"
  | "mensagem_id"
  | "apelido_aplicado";

export interface Database {
  public: {
    Tables: {
      recrutamento_config: {
        Row: ConfigRow;
        Insert: Pick<ConfigRow, "guild_id"> & Partial<ConfigRow>;
        Update: Partial<ConfigRow>;
        Relationships: [];
      };
      recrutamento_candidaturas: {
        Row: CandidaturaRow;
        Insert: Omit<CandidaturaRow, CamposAutomaticos> & Partial<Pick<CandidaturaRow, CamposAutomaticos>>;
        Update: Partial<CandidaturaRow>;
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
