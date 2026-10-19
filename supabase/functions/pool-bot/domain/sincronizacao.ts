// sincronizacao.ts - Quem precisa ganhar uma caixa de convites. Pura (sem Discord, sem banco).
//
// Regra: todo MEMBRO (quem tem o cargo de Membro) que não é bot e ainda não tem caixa.
// A criação é gradual (`limite` por rodada): cada caixa são 3 chamadas ao Discord (criar o
// tópico, adicionar a pessoa, postar o painel), e uma rodada não deve estourar o tempo da
// função nem os limites de taxa. O resto fica pra próxima rodada.

export interface MembroResumo {
  user: { id: string; bot?: boolean };
  roles: string[];
}

export function membrosSemCaixa(
  membros: MembroResumo[],
  cargoMembroId: string,
  usuariosComCaixa: Set<string>,
  limite: number,
): string[] {
  const alvos: string[] = [];
  const vistos = new Set<string>();
  for (const m of membros) {
    if (alvos.length >= limite) break;
    const id = m.user.id;
    if (m.user.bot || vistos.has(id)) continue;
    vistos.add(id);
    if (!m.roles.includes(cargoMembroId) || usuariosComCaixa.has(id)) continue;
    alvos.push(id);
  }
  return alvos;
}

// Quantas caixas criar por rodada da varredura.
export const CAIXAS_POR_RODADA = 10;
