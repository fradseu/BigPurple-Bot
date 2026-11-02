// vagas.ts - Manipulação das linhas de vaga do painel público.
//
// Cada vaga individual é UMA linha de texto: "(0/1) <formatted classe> " (vazia)
// ou "(1/1) <formatted classe> <@menção> <emojis de bônus> " (ocupada).
// Funções puras, sem I/O, pra dar pra testar isoladas do resto do sistema.

import { EmojiResolvido, formatarClasseParaMensagem } from "./emoji.ts";

export const LINHA_CRIADOR_MARCADOR = "👑 Criador:";

export function ehLinhaCriador(linha: string): boolean {
  return linha.includes(LINHA_CRIADOR_MARCADOR);
}

// Reduz um texto de vaga a uma chave comparável, ignorando o formato: tira
// contador "(0/1)", emoji renderizado "<:tag:id>", tag crua ":tag:", menções
// e emojis de bônus. Sobra só o nome da função em caixa alta — isso garante
// que ":arcolongo: BADÔNICO", "<:arcolongo:123> BADÔNICO" e "BADÔNICO" sejam
// tratados como a MESMA vaga, mesmo que o formato de emoji tenha mudado entre
// o painel ser gerado e alguém interagir com ele.
export function chaveFuncao(texto: string): string {
  return texto
    .replace(/^\(\d+\/\d+\)/, "")
    .replace(/<a?:\w+:\d+>/g, "")
    .replace(/:\w+:/g, "")
    .replace(/<@!?&?\d+>/g, "")
    .replace(/[^\p{L}\p{N} ]/gu, "")
    .replace(/\s+/g, " ")
    .trim()
    .toUpperCase();
}

// Gera as N linhas vazias de uma função com `maximo` vagas, uma por slot.
export function gerarLinhasDaFuncao(
  classe: string,
  maximo: number,
  emojisResolvidos: Map<string, EmojiResolvido>,
): string[] {
  const classeFormatada = formatarClasseParaMensagem(classe, emojisResolvidos);
  return Array.from({ length: maximo }, () => `(0/1) ${classeFormatada} `);
}

// Acha o índice da PRIMEIRA vaga vazia daquela função (chave normalizada).
// Retorna -1 se não achar nenhuma vaga livre.
export function encontrarIndiceVagaVazia(linhas: string[], vagaEscolhida: string): number {
  const chaveEscolhida = chaveFuncao(vagaEscolhida);
  return linhas.findIndex(
    (linha) =>
      !ehLinhaCriador(linha) &&
      /^\(0\/\d+\)/.test(linha.trim()) &&
      !/<@!?\d+>/.test(linha) &&
      chaveFuncao(linha) === chaveEscolhida,
  );
}

// Devolve o nome/formato de função que já estava numa linha ocupada (preserva
// o que já tava lá, em vez de reescrever com o formato atual do código).
export function extrairRotuloFuncao(linhaOcupada: string): string {
  const match = linhaOcupada.match(/^\(\d+\/\d+\)\s*(.+?)\s*<@/);
  return match ? match[1].trim() : "";
}

// Volta uma linha ocupada pro estado vazio (usado em sair da PT / kick /
// trocar de vaga), preservando o rótulo da função (com emoji, se tinha).
export function liberarLinha(linhaOcupada: string): string {
  const rotulo = extrairRotuloFuncao(linhaOcupada);
  return `(0/1) ${rotulo} `;
}

// Preenche uma vaga vazia com o jogador.
export function preencherLinha(vagaFormatada: string, mencaoUsuario: string): string {
  return `(1/1) ${vagaFormatada} ${mencaoUsuario} `;
}

export const MARCADOR_RESUMO_VAGAS = "📊 **Vagas:**";
export const MARCADOR_SALA_VOZ = "🔊 **Sala de Voz:**";

// Conta quantas vagas estão preenchidas vs total, varrendo as linhas "(x/y)".
export function contarVagas(linhas: string[]): { preenchidas: number; total: number } {
  let preenchidas = 0;
  let total = 0;

  for (const linha of linhas) {
    if (ehLinhaCriador(linha)) continue;
    const match = linha.trim().match(/^\((\d+)\/(\d+)\)/);
    if (!match) continue;
    preenchidas += Number(match[1]);
    total += Number(match[2]);
  }

  return { preenchidas, total };
}

// Recalcula e (re)insere a linha "📊 Vagas: (x/y)" no topo das linhas de vaga
// (essas linhas vivem sozinhas na description do Embed — o título "Inscrições
// Abertas" já é o embed.title, não precisa mais achar esse cabeçalho aqui).
// Chamado toda vez que alguém entra/sai/é removido de uma vaga.
export function atualizarResumoVagas(linhas: string[]): string[] {
  const semResumo = linhas.filter((linha) => !linha.startsWith(MARCADOR_RESUMO_VAGAS));
  const { preenchidas, total } = contarVagas(semResumo);
  const linhaResumo = `${MARCADOR_RESUMO_VAGAS} (${preenchidas}/${total})`;
  return [linhaResumo, "", ...semResumo];
}

export interface JogadorInscrito {
  mention: string;
  cargo: string;
}

// Varre as linhas do painel mapeando quem está inscrito e em qual cargo
// (usado pra montar o dropdown secreto de kick).
export function listarJogadoresInscritos(linhas: string[]): JogadorInscrito[] {
  const jogadores: JogadorInscrito[] = [];

  for (const linha of linhas) {
    if (ehLinhaCriador(linha)) continue;
    const mencoes = linha.match(/<@\d+>/g);
    if (!mencoes) continue;

    const matchCargo = linha.match(/\(\d+\/\d+\)\s*(.+?)\s*(?:<@|$)/);
    const cargo = matchCargo
      ? matchCargo[1]
          .replace(/<a?:\w+:\d+>\s*/g, "")
          .replace(/:\w+:\s*/g, "")
          .replace(/\s+/g, " ")
          .trim()
      : "";

    for (const mencao of mencoes) {
      if (!jogadores.some((j) => j.mention === mencao)) {
        jogadores.push({ mention: mencao, cargo });
      }
    }
  }

  return jogadores;
}

// ---------------------------------------------------------------- função (role) na vaga
// Marcada logo depois da menção, em código: "(1/1) 🌿 BASTÃO <@1> `HEALER` ⚗️ ".
const RE_ROLE = /\s*`(?:HEALER|TANK|OFF TANK|SUPORTE|DPS)`/g;

export function roleDaLinha(linha: string): string | null {
  return linha.match(/`(HEALER|TANK|OFF TANK|SUPORTE|DPS)`/)?.[1] ?? null;
}

// Troca (ou tira, com role null) a função marcada na linha ocupada.
export function aplicarRole(linha: string, role: string | null): string {
  const sem = linha.replace(RE_ROLE, "");
  if (!role) return sem;
  return sem.replace(/(<@!?\d+>)/, `$1 \`${role}\``);
}

// Índices das linhas ocupadas pelas menções dadas (ignora a linha do criador).
export function linhasDosJogadores(linhas: string[], mencoes: string[]): number[] {
  const ids = new Set(mencoes.map((m) => m.replace(/[<@!>]/g, "")));
  const out: number[] = [];
  linhas.forEach((linha, i) => {
    if (ehLinhaCriador(linha)) return;
    const id = linha.match(/<@!?(\d+)>/)?.[1];
    if (id && ids.has(id)) out.push(i);
  });
  return out;
}
