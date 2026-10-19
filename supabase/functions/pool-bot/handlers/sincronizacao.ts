// sincronizacao.ts - Varredura periódica (pg_cron): garante que TODO membro tenha a caixa
// de convites. Cobre quem já era membro quando o Pool foi ligado e quem entrar por outro
// caminho que não a aprovação do recrutamento. O Discord não avisa o bot de que alguém
// entrou (isso exigiria uma conexão permanente), então a varredura é quem "equipara".
//
// Exige a permissão especial "Server Members Intent" ligada no portal pro app do Pool.
import {
  listarServidoresComPool,
  listarUsuariosComCaixa,
  obterCargoMembro,
} from "../db/pool.ts";
import { listarMembros, MembroDoServidor } from "../discord/rest.ts";
import { CAIXAS_POR_RODADA, membrosSemCaixa } from "../domain/sincronizacao.ts";
import { prepararCaixa } from "./caixa.ts";

export interface ResultadoSincronizacao {
  servidores: number;
  caixasCriadas: number;
  falhas: number;
  pendentes: number; // ainda sem caixa depois desta rodada (ficam pra próxima)
  semPermissao: boolean; // Server Members Intent desligada
  reparadas: number; // só com `reparar`: caixas que tiveram a mensagem de controle reescrita
}

const MAX_PAGINAS = 10; // 10.000 membros: bem além do que isso precisa

async function listarTodosOsMembros(guildId: string): Promise<MembroDoServidor[]> {
  const todos: MembroDoServidor[] = [];
  let depois: string | undefined;
  for (let pagina = 0; pagina < MAX_PAGINAS; pagina++) {
    const lote = await listarMembros(guildId, depois);
    todos.push(...lote);
    if (lote.length < 1000) break;
    depois = lote[lote.length - 1].user.id;
  }
  return todos;
}

// `reparar` (chamada manual, nunca o agendador): além de criar as que faltam, reescreve a
// mensagem de controle de TODAS as caixas existentes — útil quando o texto do painel muda.
export async function sincronizarCaixas(opcoes: { reparar?: boolean } = {}): Promise<ResultadoSincronizacao> {
  const resultado: ResultadoSincronizacao = {
    servidores: 0,
    caixasCriadas: 0,
    falhas: 0,
    pendentes: 0,
    semPermissao: false,
    reparadas: 0,
  };

  for (const { guildId, canalPoolId } of await listarServidoresComPool()) {
    const cargoMembroId = await obterCargoMembro(guildId);
    if (!cargoMembroId) continue; // sem cargo de Membro configurado, não há quem sincronizar
    resultado.servidores++;

    let membros: MembroDoServidor[];
    try {
      membros = await listarTodosOsMembros(guildId);
    } catch (err) {
      const texto = err instanceof Error ? err.message : String(err);
      if (texto.includes("-> 403")) resultado.semPermissao = true;
      console.error("Erro ao listar membros (a permissão Server Members Intent está ligada?):", err);
      continue;
    }

    const comCaixa = await listarUsuariosComCaixa(guildId);
    const alvos = membrosSemCaixa(membros, cargoMembroId, comCaixa, CAIXAS_POR_RODADA);

    for (const userId of alvos) {
      try {
        await prepararCaixa(guildId, userId, canalPoolId);
        resultado.caixasCriadas++;
      } catch (err) {
        // Uma pessoa com problema (saiu, DM/permissão) não pode travar as outras.
        resultado.falhas++;
        console.error("Erro ao criar caixa na varredura:", err);
      }
    }

    if (opcoes.reparar) {
      for (const userId of await listarUsuariosComCaixa(guildId)) {
        try {
          await prepararCaixa(guildId, userId, canalPoolId);
          resultado.reparadas++;
        } catch (err) {
          resultado.falhas++;
          console.error("Erro ao reparar caixa:", err);
        }
      }
    }

    const restantes = membrosSemCaixa(membros, cargoMembroId, await listarUsuariosComCaixa(guildId), 1_000_000);
    resultado.pendentes += restantes.length;
  }

  return resultado;
}
