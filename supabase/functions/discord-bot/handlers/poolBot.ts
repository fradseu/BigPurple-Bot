// poolBot.ts - Chama o bot de POOL (outra Edge Function) pra enviar convites. Só ele
// consegue postar na caixa privada da pessoa, e só ele sabe quem a pessoa é: este
// lado manda IDs de DISPONIBILIDADE e recebe só o status de cada convite.
//
// Rota INTERNA protegida por segredo compartilhado (PT_INTERNAL_SECRET) — não é do Discord.

export type StatusConvite = "enviado" | "indisponivel" | "ja_convidado" | "limite" | "erro";

export interface PedidoConvite {
  guild_id: string;
  pt_canal_id: string;
  pt_mensagem_id: string;
  pt_titulo: string;
  lider_user_id: string;
  itens: Array<{ disponibilidade_id: string; classe: string }>;
}

export async function convidarNoPool(
  pedido: PedidoConvite,
): Promise<Array<{ disponibilidade_id: string; status: StatusConvite }> | null> {
  const base = Deno.env.get("SUPABASE_URL");
  const segredo = Deno.env.get("PT_INTERNAL_SECRET");
  if (!base || !segredo) return null;

  try {
    const res = await fetch(`${base}/functions/v1/pool-bot/convidar`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": segredo },
      body: JSON.stringify(pedido),
      signal: AbortSignal.timeout(20_000),
    });
    if (!res.ok) {
      console.error("Pool recusou o pedido de convite:", res.status, await res.text().catch(() => ""));
      return null;
    }
    const corpo = await res.json() as { resultados?: Array<{ disponibilidade_id: string; status: StatusConvite }> };
    return corpo.resultados ?? null;
  } catch (err) {
    console.error("Erro ao chamar o bot de pool:", err);
    return null;
  }
}
