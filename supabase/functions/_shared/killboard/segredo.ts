// segredo.ts - Segredo das rotas internas: KILLBOARD_CRON_SECRET (secret da function) ou a linha
// 'interno' de public.bot_segredos. A tabela só é lida pela service role e é a mesma que o pg_cron
// usa, então o segredo nunca vai pro Git nem precisa ser digitado em painel.
import { createClient } from "@supabase/supabase-js";

let cache: string | null = null;

export async function segredoInterno(): Promise<string> {
  const doEnv = Deno.env.get("KILLBOARD_CRON_SECRET");
  if (doEnv) return doEnv;
  if (cache) return cache;
  const db = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
  const { data } = await db.from("bot_segredos").select("valor").eq("nome", "interno").maybeSingle();
  cache = (data as { valor: string } | null)?.valor ?? "";
  return cache;
}

// Comparação em tempo constante.
export function segredosIguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}
