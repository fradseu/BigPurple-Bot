// albion.ts - Lê os eventos recentes (kills/mortes) de uma guilda na API oficial do Albion
// (gameinfo, servidor das Américas). A API é lenta e às vezes cai: tempo limite + novas tentativas.
import { EventoAlbion } from "./dominio.ts";

const BASE = "https://gameinfo.albiononline.com/api/gameinfo";
const TEMPO_LIMITE_MS = 20_000;
const TENTATIVAS = 3;
// A API aceita no máximo 51 por página.
const POR_PAGINA = 51;

async function buscarJson<T>(caminho: string): Promise<T> {
  let ultimoErro: unknown;
  for (let tentativa = 1; tentativa <= TENTATIVAS; tentativa++) {
    try {
      const res = await fetch(`${BASE}${caminho}`, {
        headers: { "user-agent": "BigPurple-Bot/1.0" },
        signal: AbortSignal.timeout(TEMPO_LIMITE_MS),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      return await res.json() as T;
    } catch (err) {
      ultimoErro = err;
      if (tentativa < TENTATIVAS) await new Promise((r) => setTimeout(r, 2_000 * tentativa));
    }
  }
  throw new Error(`Albion ${caminho} falhou depois de ${TENTATIVAS} tentativas: ${ultimoErro}`);
}

// Eventos em que alguém da guilda matou ou morreu, do mais recente pro mais antigo.
// Lê página por página até `chegou(pagina)` dizer que já alcançou o que foi postado antes
// (ou até `paginas`). Assim, quando a API volta depois de horas fora, recupera o atraso em vez
// de olhar só os 51 últimos. Se uma página seguinte falhar, devolve o que já leu.
export async function buscarEventosDaGuilda(
  albionGuildId: string,
  paginas = 1,
  chegou: (pagina: EventoAlbion[]) => Promise<boolean> | boolean = () => false,
): Promise<EventoAlbion[]> {
  const todos: EventoAlbion[] = [];
  for (let p = 0; p < paginas; p++) {
    let pagina: EventoAlbion[];
    try {
      pagina = await buscarJson<EventoAlbion[]>(
        `/events?limit=${POR_PAGINA}&offset=${p * POR_PAGINA}&guildId=${encodeURIComponent(albionGuildId)}`,
      );
    } catch (err) {
      if (p === 0) throw err;
      console.error(`Página ${p + 1} de eventos falhou; seguindo com ${todos.length} eventos.`, err);
      break;
    }
    todos.push(...pagina);
    if (pagina.length < POR_PAGINA || (await chegou(pagina))) break;
  }
  return todos;
}
