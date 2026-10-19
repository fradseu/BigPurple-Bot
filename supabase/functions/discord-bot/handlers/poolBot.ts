// poolBot.ts - Chama o bot de POOL (outra Edge Function) pra enviar convites. Só ele
// consegue postar na caixa privada da pessoa, e só ele sabe quem a pessoa é: este
// lado manda IDs de DISPONIBILIDADE e recebe só o status de cada convite.
//
// Rota INTERNA protegida por segredo compartilhado (PT_INTERNAL_SECRET) — não é do Discord.
import { RespostaEnvio } from "../domain/catalogo.ts";

export type TipoConvite = "preencher" | "agregar" | "substituir";

export interface ItemConvite {
  disponibilidade_id: string;
  classe: string; // classe DA PESSOA (a vaga que ela vai ocupar)
  tipo: TipoConvite;
  classe_remover?: string; // só no "substituir": função da vaga LIVRE a apagar se ela aceitar
}

export interface PedidoConvite {
  guild_id: string;
  pt_canal_id: string;
  pt_mensagem_id: string;
  pt_detalhes: string; // atividade, ponto de encontro, ambiente, quando, requisitos (sem o criador)
  lider_user_id: string;
  itens: ItemConvite[];
}

// null = não consegui falar com o Pool (rede, segredo, erro 5xx).
export async function convidarNoPool(pedido: PedidoConvite): Promise<RespostaEnvio | null> {
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
    return await res.json() as RespostaEnvio & { resultados: Array<{ disponibilidade_id: string; status: string }> };
  } catch (err) {
    console.error("Erro ao chamar o bot de pool:", err);
    return null;
  }
}
