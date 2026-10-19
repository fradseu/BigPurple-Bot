// conteudoBot.ts - Chama o bot de CONTEÚDO (outra Edge Function) pra preencher a vaga
// na PT quando alguém aceita um convite. A mensagem da PT foi postada por ele,
// então só ele (com o token dele) consegue editá-la.
//
// A chamada vai pra uma rota INTERNA protegida por segredo compartilhado
// (PT_INTERNAL_SECRET) — não é uma rota do Discord.

export type MotivoFalhaPreencher = "vaga_lotada" | "pt_nao_encontrada" | "ja_na_pt" | "erro";

export type ResultadoPreencher = { ok: true } | { ok: false; motivo: MotivoFalhaPreencher };

export async function preencherVagaNaPT(params: {
  guildId: string;
  ptCanalId: string;
  ptMensagemId: string;
  userId: string;
  classe: string;
}): Promise<ResultadoPreencher> {
  const base = Deno.env.get("SUPABASE_URL");
  const segredo = Deno.env.get("PT_INTERNAL_SECRET");
  if (!base || !segredo) return { ok: false, motivo: "erro" };

  try {
    const res = await fetch(`${base}/functions/v1/discord-bot/internal/preencher`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-internal-secret": segredo },
      body: JSON.stringify({
        guild_id: params.guildId,
        pt_canal_id: params.ptCanalId,
        pt_mensagem_id: params.ptMensagemId,
        user_id: params.userId,
        classe: params.classe,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const corpo = await res.json().catch(() => null) as { ok?: boolean; motivo?: string } | null;
    if (res.ok && corpo?.ok === true) return { ok: true };

    const motivo = corpo?.motivo;
    if (motivo === "vaga_lotada" || motivo === "pt_nao_encontrada" || motivo === "ja_na_pt") {
      return { ok: false, motivo };
    }
    console.error("Bot de conteúdo recusou o preenchimento:", res.status, corpo);
    return { ok: false, motivo: "erro" };
  } catch (err) {
    console.error("Erro ao chamar o bot de conteúdo:", err);
    return { ok: false, motivo: "erro" };
  }
}
