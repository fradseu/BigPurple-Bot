// expiracao.ts - Rotina agendada (pg_cron chama a cada minuto): tira do catálogo
// quem passou do prazo e atualiza a mensagem de controle da caixa ("⚪ fora da lista").
// A função do Supabase não consegue "esperar" minutos, por isso é o agendador que cutuca.
import { expirarVencidas, obterCaixa } from "../db/pool.ts";
import { atualizarControle } from "./caixa.ts";

export interface ResultadoExpiracao {
  expiradas: number;
  atualizadas: number;
  falhas: number;
}

export async function expirarEAtualizarCaixas(agora: Date = new Date()): Promise<ResultadoExpiracao> {
  const vencidas = await expirarVencidas(agora);
  let atualizadas = 0;
  let falhas = 0;

  for (const d of vencidas) {
    try {
      const caixa = await obterCaixa(d.guild_id, d.user_id);
      if (caixa) {
        await atualizarControle(caixa, null);
        atualizadas++;
      }
    } catch (err) {
      // Uma caixa com problema (tópico apagado, permissão) não pode impedir as outras.
      falhas++;
      console.error("Erro ao atualizar caixa expirada:", err);
    }
  }

  return { expiradas: vencidas.length, atualizadas, falhas };
}
