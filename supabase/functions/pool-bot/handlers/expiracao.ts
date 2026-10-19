// expiracao.ts - Rotina agendada (pg_cron chama a cada minuto):
//   1. tira do catálogo quem passou do prazo e atualiza a caixa ("⚪ fora da lista");
//   2. expira convites pendentes vencidos (3 min) e apaga a mensagem da caixa.
// A função do Supabase não consegue "esperar" minutos, por isso é o agendador que cutuca.
import { expirarConvitesVencidos, expirarVencidas, obterCaixa } from "../db/pool.ts";
import { atualizarControle } from "./caixa.ts";
import { apagarMensagensDeConvites, cancelarConvitesEApagar } from "./convite.ts";

export interface ResultadoExpiracao {
  expiradas: number;
  atualizadas: number;
  falhas: number;
  convitesExpirados: number;
}

export async function expirarEAtualizarCaixas(agora: Date = new Date()): Promise<ResultadoExpiracao> {
  // Convites primeiro: assim o convite de uma disponibilidade que acabou de vencer
  // some junto, sem ficar uma mensagem solta na caixa.
  const convitesVencidos = await expirarConvitesVencidos(agora);
  await apagarMensagensDeConvites(convitesVencidos);

  const vencidas = await expirarVencidas(agora);
  let atualizadas = 0;
  let falhas = 0;

  for (const d of vencidas) {
    try {
      await cancelarConvitesEApagar(d.id);
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

  return { expiradas: vencidas.length, atualizadas, falhas, convitesExpirados: convitesVencidos.length };
}
