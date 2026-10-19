// preenchimento.ts - Coloca UMA pessoa numa PT a partir de um convite aceito no Pool.
// Três jeitos, conforme o tipo do convite:
//   preencher  : ocupa uma vaga LIVRE da função dela
//   agregar    : cria uma vaga NOVA pra ela (a PT cresce)
//   substituir : cria uma vaga nova pra ela E apaga uma vaga LIVRE indicada pelo líder
//                (a PT mantém o tamanho)
// Pura (sem I/O), pra testar todos os casos sem Discord.
import {
  atualizarResumoVagas,
  contarVagas,
  ehLinhaCriador,
  encontrarIndiceVagaVazia,
  preencherLinha,
} from "./vagas.ts";

// Teto de vagas numa PT (o dropdown aceita 25 funções diferentes e o painel é um embed).
export const MAX_VAGAS_PT = 30;

export type FalhaPreenchimento =
  | "vaga_lotada"
  | "ja_na_pt"
  | "vaga_a_remover_ocupada"
  | "limite_vagas";

export type ResultadoPreenchimento =
  | { ok: true; linhas: string[] }
  | { ok: false; motivo: FalhaPreenchimento };

// Já está em alguma vaga dessa PT? Não duplica a pessoa.
function jaEstaNaPT(linhas: string[], mencao: string): boolean {
  return linhas.some((l) => !ehLinhaCriador(l) && l.includes(mencao));
}

export function preencherVagaComJogador(
  linhas: string[],
  userId: string,
  classe: string,
): ResultadoPreenchimento {
  const mencao = `<@${userId}>`;
  if (jaEstaNaPT(linhas, mencao)) return { ok: false, motivo: "ja_na_pt" };

  const indice = encontrarIndiceVagaVazia(linhas, classe);
  if (indice === -1) return { ok: false, motivo: "vaga_lotada" };

  // Mantém o rótulo que já estava na linha livre (com o emoji do servidor), em vez de
  // reescrever com o formato atual do código — o mesmo que o dropdown faz ao liberar.
  const rotulo = linhas[indice].replace(/^\(\d+\/\d+\)\s*/, "").trim();
  const novas = [...linhas];
  novas[indice] = preencherLinha(rotulo, mencao);

  return { ok: true, linhas: atualizarResumoVagas(novas) };
}

// "agregar": a PT ganha uma vaga a mais, já ocupada pela pessoa.
// `rotuloFormatado` é o nome da função já com o emoji do servidor ("<:x:1> FURA-BRUMA").
export function agregarVagaComJogador(
  linhas: string[],
  userId: string,
  rotuloFormatado: string,
): ResultadoPreenchimento {
  const mencao = `<@${userId}>`;
  if (jaEstaNaPT(linhas, mencao)) return { ok: false, motivo: "ja_na_pt" };
  if (contarVagas(linhas).total >= MAX_VAGAS_PT) return { ok: false, motivo: "limite_vagas" };

  return { ok: true, linhas: atualizarResumoVagas([...linhas, preencherLinha(rotuloFormatado, mencao)]) };
}

// "substituir": igual a agregar, mas antes apaga UMA vaga livre da função `classeRemover`.
// Só apaga vaga LIVRE — nunca alguém que já está na PT. Se a vaga indicada foi ocupada
// enquanto o convite estava aberto, falha (o convite não vale mais) em vez de adivinhar.
export function substituirVagaComJogador(
  linhas: string[],
  userId: string,
  rotuloFormatado: string,
  classeRemover: string,
): ResultadoPreenchimento {
  const mencao = `<@${userId}>`;
  if (jaEstaNaPT(linhas, mencao)) return { ok: false, motivo: "ja_na_pt" };

  const indiceRemover = encontrarIndiceVagaVazia(linhas, classeRemover);
  if (indiceRemover === -1) return { ok: false, motivo: "vaga_a_remover_ocupada" };

  const semAVaga = linhas.filter((_, i) => i !== indiceRemover);
  return { ok: true, linhas: atualizarResumoVagas([...semAVaga, preencherLinha(rotuloFormatado, mencao)]) };
}
