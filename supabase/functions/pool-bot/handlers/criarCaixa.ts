// criarCaixa.ts - Rota interna POST /criar-caixa: o bot de RECRUTAMENTO chama quando
// aprova alguém, pra a pessoa já entrar com a caixa de convites pronta (e o botão
// "Ficar disponível" dentro dela, sem precisar de painel nem de comando). Também serve
// pra REPARAR uma caixa cuja mensagem de controle foi apagada.
import { obterConfigPool } from "../db/pool.ts";
import { prepararCaixa } from "./caixa.ts";

export type RespostaCriarCaixa =
  | { ok: true; criada: boolean; thread_id: string }
  | { ok: false; motivo: "pool_nao_configurado" | "pedido_invalido" | "erro" };

export function validarPedidoCriarCaixa(bruto: unknown): { guildId: string; userId: string } | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;
  const snowflake = (v: unknown) => typeof v === "string" && /^\d{15,25}$/.test(v) ? v : null;
  const guildId = snowflake(o.guild_id);
  const userId = snowflake(o.user_id);
  return guildId && userId ? { guildId, userId } : null;
}

export async function criarCaixaParaMembro(guildId: string, userId: string): Promise<RespostaCriarCaixa> {
  const config = await obterConfigPool(guildId);
  // Servidor que nunca usou o Pool: não é erro, só não há onde criar caixa.
  if (!config?.canal_pool_id) return { ok: false, motivo: "pool_nao_configurado" };

  try {
    const { caixa, criada } = await prepararCaixa(guildId, userId, config.canal_pool_id);
    return { ok: true, criada, thread_id: caixa.thread_id };
  } catch (err) {
    console.error("Erro ao preparar a caixa do membro:", err);
    return { ok: false, motivo: "erro" };
  }
}
