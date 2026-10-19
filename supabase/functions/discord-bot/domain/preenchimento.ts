// preenchimento.ts - Coloca UMA pessoa numa vaga livre de uma função, a partir de um
// convite aceito no Pool. Mesma lógica de "entrar na PT" do dropdown, mas sem uma
// interação do jogador: recebe as linhas do painel e devolve as linhas novas.
// Pura (sem I/O), pra testar todos os casos sem Discord.
import {
  atualizarResumoVagas,
  ehLinhaCriador,
  encontrarIndiceVagaVazia,
  preencherLinha,
} from "./vagas.ts";

export type FalhaPreenchimento = "vaga_lotada" | "ja_na_pt";

export type ResultadoPreenchimento =
  | { ok: true; linhas: string[] }
  | { ok: false; motivo: FalhaPreenchimento };

export function preencherVagaComJogador(
  linhas: string[],
  userId: string,
  classe: string,
): ResultadoPreenchimento {
  const mencao = `<@${userId}>`;

  // Já está em alguma vaga dessa PT? Não duplica a pessoa.
  if (linhas.some((l) => !ehLinhaCriador(l) && l.includes(mencao))) {
    return { ok: false, motivo: "ja_na_pt" };
  }

  const indice = encontrarIndiceVagaVazia(linhas, classe);
  if (indice === -1) return { ok: false, motivo: "vaga_lotada" };

  // Mantém o rótulo que já estava na linha livre (com o emoji do servidor), em vez de
  // reescrever com o formato atual do código — o mesmo que o dropdown faz ao liberar.
  const rotulo = linhas[indice].replace(/^\(\d+\/\d+\)\s*/, "").trim();
  const novas = [...linhas];
  novas[indice] = preencherLinha(rotulo, mencao);

  return { ok: true, linhas: atualizarResumoVagas(novas) };
}
