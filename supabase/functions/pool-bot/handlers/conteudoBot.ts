// conteudoBot.ts - Chama o bot de CONTEÚDO (outra Edge Function) pra colocar a pessoa
// na PT quando alguém aceita um convite. A mensagem da PT foi postada por ele, então
// só ele (com o token dele) consegue editá-la.
//
// A chamada vai pra uma rota INTERNA protegida por segredo compartilhado
// (PT_INTERNAL_SECRET) — não é uma rota do Discord.
import { TipoConvite } from "../domain/convite.ts";

export type MotivoFalhaPreencher =
  | "vaga_lotada"
  | "pt_nao_encontrada"
  | "ja_na_pt"
  | "vaga_a_remover_ocupada" // substituir: a vaga livre indicada foi ocupada nesse meio tempo
  | "limite_vagas" // agregar: a PT já está no máximo de vagas
  | "erro";

export type ResultadoPreencher = { ok: true } | { ok: false; motivo: MotivoFalhaPreencher };

const MOTIVOS_CONHECIDOS: MotivoFalhaPreencher[] = [
  "vaga_lotada",
  "pt_nao_encontrada",
  "ja_na_pt",
  "vaga_a_remover_ocupada",
  "limite_vagas",
];

export async function preencherVagaNaPT(params: {
  guildId: string;
  ptCanalId: string;
  ptMensagemId: string;
  userId: string;
  classe: string;
  tipo: TipoConvite;
  classeRemover: string | null;
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
        tipo: params.tipo,
        classe_remover: params.classeRemover,
      }),
      signal: AbortSignal.timeout(15_000),
    });
    const corpo = await res.json().catch(() => null) as { ok?: boolean; motivo?: string } | null;
    if (res.ok && corpo?.ok === true) return { ok: true };

    const motivo = MOTIVOS_CONHECIDOS.find((m) => m === corpo?.motivo);
    if (motivo) return { ok: false, motivo };
    console.error("Bot de conteúdo recusou o preenchimento:", res.status, corpo);
    return { ok: false, motivo: "erro" };
  } catch (err) {
    console.error("Erro ao chamar o bot de conteúdo:", err);
    return { ok: false, motivo: "erro" };
  }
}
