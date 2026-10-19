// poolBot.ts - Pede ao bot de POOL (outra Edge Function) a caixa de convites de quem acabou
// de ser aprovado. Só o Pool consegue criar o tópico privado no canal dele; aqui só pedimos.
//
// Rota INTERNA protegida por segredo compartilhado (PT_INTERNAL_SECRET) — não é do Discord.

export type ResultadoCaixa =
  | "criada" // a pessoa ganhou a caixa agora
  | "ja_existia" // já tinha caixa (a mensagem de controle foi conferida/reparada)
  | "sem_pool" // esse servidor não usa o Pool: nada a fazer, não é erro
  | "erro";

export async function criarCaixaNoPool(guildId: string, userId: string): Promise<ResultadoCaixa> {
  const base = Deno.env.get("SUPABASE_URL");
  const segredo = Deno.env.get("PT_INTERNAL_SECRET");
  if (!base || !segredo) return "erro";

  try {
    const res = await fetch(`${base}/functions/v1/pool-bot/criar-caixa`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": segredo },
      body: JSON.stringify({ guild_id: guildId, user_id: userId }),
      signal: AbortSignal.timeout(20_000),
    });
    const corpo = await res.json().catch(() => null) as
      | { ok?: boolean; criada?: boolean; motivo?: string }
      | null;
    if (corpo?.ok === true) return corpo.criada ? "criada" : "ja_existia";
    if (corpo?.motivo === "pool_nao_configurado") return "sem_pool";
    console.error("Pool não criou a caixa:", res.status, corpo);
    return "erro";
  } catch (err) {
    console.error("Erro ao pedir a caixa ao Pool:", err);
    return "erro";
  }
}
