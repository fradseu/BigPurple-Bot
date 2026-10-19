// convidar.ts - Rota interna POST /convidar (chamada pelo bot de conteúdo quando o
// líder escolhe alguém no catálogo ou convida em massa). Cria o convite e o posta na
// caixa privada da pessoa. O pedido traz IDs de DISPONIBILIDADE, nunca o usuário: quem
// resolve "qual pessoa é essa" é só este lado — o líder nunca vê o nick antes do aceite.
//
// Anti-flood por PT: um envio a cada 5 minutos e no máximo 5 tentativas (cada envio, em
// massa ou avulso, é UMA tentativa). Se nenhum convite chegar a ser enviado, a tentativa
// é devolvida — não queima o limite por convite que nem existia mais.
import {
  contarConvitesPendentesDaPT,
  criarConvite,
  definirStatusConvite,
  devolverEnvio,
  obterCaixa,
  obterDisponibilidadePorId,
  registrarMensagemDoConvite,
  reservarEnvio,
} from "../db/pool.ts";
import {
  calcularExpiracaoConvite,
  MAX_CONVITES_PENDENTES_POR_PT,
  montarConvite,
  PedidoConvite,
  RespostaConvidar,
  ResultadoItemConvite,
} from "../domain/convite.ts";
import { enviarMensagem } from "../discord/rest.ts";

export async function processarPedidoConvite(pedido: PedidoConvite): Promise<RespostaConvidar> {
  // MODO DE TESTE (segredo PT_MODO_TESTE=1, desligado por padrão): sem limite de envio e
  // com auto-convite permitido, pra testar o fluxo inteiro com uma conta só.
  const modoTeste = Deno.env.get("PT_MODO_TESTE") === "1";

  let reserva: Awaited<ReturnType<typeof reservarEnvio>> | null = null;
  if (!modoTeste) {
    reserva = await reservarEnvio(pedido.guild_id, pedido.pt_mensagem_id, Date.now());
    if (!reserva.ok) {
      const { motivo, tentativas } = reserva.bloqueio;
      const esperaSeg = reserva.bloqueio.motivo === "espere" ? reserva.bloqueio.esperaSeg : 0;
      return { resultados: [], bloqueio: { motivo, esperaSeg, tentativas } };
    }
  }

  const resultados: ResultadoItemConvite[] = [];
  let pendentes = await contarConvitesPendentesDaPT(pedido.pt_mensagem_id);

  for (const item of pedido.itens) {
    const resultado = (status: ResultadoItemConvite["status"]): ResultadoItemConvite => ({
      disponibilidade_id: item.disponibilidade_id,
      status,
    });

    try {
      if (pendentes >= MAX_CONVITES_PENDENTES_POR_PT) {
        resultados.push(resultado("limite"));
        continue;
      }

      const disp = await obterDisponibilidadePorId(item.disponibilidade_id);
      const agora = Date.now();
      const valida = disp && disp.guild_id === pedido.guild_id && disp.status === "ativa" &&
        Date.parse(disp.expira_em) > agora &&
        (modoTeste || disp.user_id !== pedido.lider_user_id); // ninguém convida a si mesmo
      if (!valida) {
        resultados.push(resultado("indisponivel"));
        continue;
      }

      const caixa = await obterCaixa(disp.guild_id, disp.user_id);
      if (!caixa) {
        resultados.push(resultado("indisponivel"));
        continue;
      }

      const expiraEm = calcularExpiracaoConvite(agora);
      const criado = await criarConvite({
        guild_id: pedido.guild_id,
        disponibilidade_id: disp.id,
        candidato_user_id: disp.user_id,
        lider_user_id: pedido.lider_user_id,
        pt_canal_id: pedido.pt_canal_id,
        pt_mensagem_id: pedido.pt_mensagem_id,
        classe: item.classe,
        tipo: item.tipo,
        classe_remover: item.classe_remover,
        thread_id: caixa.thread_id,
        expira_em: expiraEm.toISOString(),
      });
      if (criado.tipo === "ja_convidado") {
        resultados.push(resultado("ja_convidado"));
        continue;
      }

      try {
        const mensagem = await enviarMensagem(
          caixa.thread_id,
          montarConvite({
            conviteId: criado.convite.id,
            candidatoUserId: disp.user_id,
            ptDetalhes: pedido.pt_detalhes,
            classe: item.classe,
            tipo: item.tipo,
            expiraEmMs: expiraEm.getTime(),
          }),
        );
        await registrarMensagemDoConvite(criado.convite.id, mensagem.id);
        pendentes++;
        resultados.push(resultado("enviado"));
      } catch (err) {
        // Convite sem mensagem seria um fantasma pendente: cancela e conta como erro.
        await definirStatusConvite(criado.convite.id, "cancelado").catch(() => {});
        throw err;
      }
    } catch (err) {
      // Um convite com problema (tópico apagado, permissão) não derruba os outros.
      console.error("Erro ao enviar convite:", err);
      resultados.push(resultado("erro"));
    }
  }

  // Nada foi enviado: devolve a tentativa (não queima o limite à toa).
  if (reserva?.ok && !resultados.some((r) => r.status === "enviado")) {
    await devolverEnvio(pedido.pt_mensagem_id, reserva.anterior).catch((e) =>
      console.error("Erro ao devolver tentativa de envio:", e)
    );
  }

  return { resultados };
}
