// pings.ts - Pings salvos do /conteudo (até 2 por jogador): título + armas/quantidades.
import { obterClienteSupabase } from "./client.ts";

export const MAX_PINGS = 2;

export interface PingSalvo {
  slot: number;
  titulo: string;
  funcoes: Record<string, number>;
}

// deno-lint-ignore no-explicit-any
const tabela = () => (obterClienteSupabase() as any).from("conteudo_pings");

export async function listarPings(liderId: string): Promise<PingSalvo[]> {
  const { data, error } = await tabela()
    .select("slot, titulo, funcoes")
    .eq("lider_id", liderId)
    .order("slot");
  if (error) throw new Error(`Erro ao ler pings salvos: ${error.message}`);
  return ((data ?? []) as PingSalvo[]).map((p) => ({ slot: p.slot, titulo: p.titulo, funcoes: p.funcoes ?? {} }));
}

export async function salvarPing(liderId: string, ping: PingSalvo): Promise<void> {
  const { error } = await tabela().upsert({
    lider_id: liderId,
    slot: ping.slot,
    titulo: ping.titulo,
    funcoes: ping.funcoes,
    atualizado_em: new Date().toISOString(),
  });
  if (error) throw new Error(`Erro ao salvar ping: ${error.message}`);
}

// Primeiro slot livre (1 ou 2), ou null se os dois estão ocupados.
export function slotLivre(pings: PingSalvo[]): number | null {
  for (let s = 1; s <= MAX_PINGS; s++) if (!pings.some((p) => p.slot === s)) return s;
  return null;
}
