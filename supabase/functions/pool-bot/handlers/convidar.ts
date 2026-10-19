// convidar.ts - Rota interna POST /convidar (chamada pelo bot de conteúdo quando o
// líder escolhe alguém no catálogo). Cria o convite e o posta na caixa privada da
// pessoa. O pedido traz IDs de DISPONIBILIDADE, nunca o usuário: quem resolve
// "qual pessoa é essa" é só este lado — o líder nunca vê o nick antes do aceite.
import {
  contarConvitesPendentesDaPT,
  criarConvite,
  definirStatusConvite,
  obterCaixa,
  obterDisponibilidadePorId,
  registrarMensagemDoConvite,
} from "../db/pool.ts";
import {
  calcularExpiracaoConvite,
  MAX_CONVITES_PENDENTES_POR_PT,
  montarConvite,
  PedidoConvite,
  ResultadoItemConvite,
} from "../domain/convite.ts";
import { enviarMensagem } from "../discord/rest.ts";

export async function processarPedidoConvite(pedido: PedidoConvite): Promise<ResultadoItemConvite[]> {
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
      // Ninguém convida a si mesmo — exceto no MODO DE TESTE (segredo PT_MODO_TESTE=1,
      // desligado por padrão), que permite testar o fluxo inteiro com uma conta só.
      const modoTeste = Deno.env.get("PT_MODO_TESTE") === "1";
      const valida = disp && disp.guild_id === pedido.guild_id && disp.status === "ativa" &&
        Date.parse(disp.expira_em) > agora &&
        (modoTeste || disp.user_id !== pedido.lider_user_id);
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
        pt_titulo: pedido.pt_titulo,
        classe: item.classe,
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
            liderUserId: pedido.lider_user_id,
            ptTitulo: pedido.pt_titulo,
            classe: item.classe,
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

  return resultados;
}
