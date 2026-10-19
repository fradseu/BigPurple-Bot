// caixa.ts - A caixa de entrada privada de cada pessoa: UM tópico privado fixo no
// canal do pool, só com ela e o bot. Criada na primeira vez que a pessoa se
// oferece (ou é convidada) — não em massa, então não precisa listar os membros
// do servidor, e quem já estava e quem chegar depois ficam iguais.
import {
  apagarCaixa,
  atualizarControleDaCaixa,
  criarCaixa,
  obterCaixa,
} from "../db/pool.ts";
import { CaixaRow, DisponibilidadeRow } from "../db/client.ts";
import { DisponibilidadeResumo, montarControle } from "../domain/controle.ts";
import { gerarCodigo } from "../domain/pseudonimo.ts";
import {
  adicionarMembroAoTopico,
  apagarCanal,
  criarTopicoPrivado,
  editarMensagem,
  enviarMensagem,
  erroNaoEncontrado,
} from "../discord/rest.ts";

const NOME_DO_TOPICO = "📬 Caixa de convites";
const MAX_TENTATIVAS_CODIGO = 5;

export function resumoDe(d: DisponibilidadeRow): DisponibilidadeResumo {
  return {
    areas: d.areas,
    atividades: d.atividades,
    classes: d.classes,
    tier: d.tier,
    expiraEm: Date.parse(d.expira_em),
  };
}

// Devolve a caixa da pessoa, criando (tópico privado + mensagem de controle) se ainda não existir.
export async function garantirCaixa(
  guildId: string,
  userId: string,
  canalPoolId: string,
): Promise<CaixaRow> {
  const existente = await obterCaixa(guildId, userId);
  if (existente) return existente;

  const topico = await criarTopicoPrivado(canalPoolId, NOME_DO_TOPICO);

  try {
    await adicionarMembroAoTopico(topico.id, userId);

    let codigo = gerarCodigo();
    const inicial = montarControle(codigo, null, Date.now());
    const controle = await enviarMensagem(topico.id, {
      embeds: [inicial.embed],
      components: inicial.components,
    });

    for (let tentativa = 0; tentativa < MAX_TENTATIVAS_CODIGO; tentativa++) {
      const resultado = await criarCaixa({
        guild_id: guildId,
        user_id: userId,
        thread_id: topico.id,
        pseudonimo: codigo,
        controle_mensagem_id: controle.id,
      });

      if (resultado.tipo === "criada") return resultado.caixa;

      if (resultado.tipo === "usuario_ja_tem_caixa") {
        // Dois cliques ao mesmo tempo criaram dois tópicos: fica o primeiro, apaga este.
        await apagarCanal(topico.id).catch((e) => console.error("Erro ao apagar tópico duplicado:", e));
        const ja = await obterCaixa(guildId, userId);
        if (ja) return ja;
        throw new Error("A caixa já existia mas não foi encontrada");
      }

      // Código repetido (outro usuário tem o mesmo): sorteia outro e atualiza a mensagem.
      codigo = gerarCodigo();
      const novo = montarControle(codigo, null, Date.now());
      await editarMensagem(topico.id, controle.id, { embeds: [novo.embed], components: novo.components });
    }
    throw new Error("Não consegui gerar um código único pra caixa");
  } catch (err) {
    // Falhou depois de criar o tópico: não deixa tópico órfão pra trás.
    await apagarCanal(topico.id).catch((e) => console.error("Erro ao apagar tópico órfão:", e));
    throw err;
  }
}

// Atualiza a mensagem de controle da caixa (🟢 disponível / ⚪ fora da lista).
// Se o tópico/mensagem foi apagado por um moderador, recria a mensagem ou, se o
// tópico inteiro sumiu, esquece a caixa (a próxima ação cria uma nova).
export async function atualizarControle(
  caixa: CaixaRow,
  disponibilidade: DisponibilidadeResumo | null,
): Promise<void> {
  const { embed, components } = montarControle(caixa.pseudonimo, disponibilidade, Date.now());
  const payload = { embeds: [embed], components };

  try {
    if (!caixa.controle_mensagem_id) throw new Error("-> 404 sem mensagem de controle registrada");
    await editarMensagem(caixa.thread_id, caixa.controle_mensagem_id, payload);
    return;
  } catch (err) {
    if (!erroNaoEncontrado(err)) throw err;
  }

  try {
    const nova = await enviarMensagem(caixa.thread_id, payload);
    await atualizarControleDaCaixa(caixa.guild_id, caixa.user_id, nova.id);
  } catch (err) {
    if (!erroNaoEncontrado(err)) throw err;
    await apagarCaixa(caixa.guild_id, caixa.user_id);
  }
}
