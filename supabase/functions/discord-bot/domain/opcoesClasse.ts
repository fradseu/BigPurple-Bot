// opcoesClasse.ts - O dropdown "Selecione sua classe" da PT e o vínculo entre o NOME
// simples de uma função ("BADÔNICO", como o Pool guarda) e o formato completo do
// criador de conteúdo (":arcolongo: BADÔNICO", com a tag do emoji). Puro.
import { FUNCOES } from "../config.ts";
import { SelectOption } from "../discord/types.ts";
import { compararClasses, EmojiResolvido, emojiParaComponente, parseClasseComEmoji } from "./emoji.ts";
import { chaveFuncao, ehLinhaCriador } from "./vagas.ts";

const MAX_OPCOES = 25; // limite do Discord por lista

// "BADÔNICO" -> ":arcolongo: BADÔNICO" (ou null se não for uma função conhecida)
export function rotuloCompletoDaClasse(nome: string): string | null {
  const chave = chaveFuncao(nome);
  return FUNCOES.find((f) => chaveFuncao(f) === chave)?.trim() ?? null;
}

// Posição da função na lista do criador de conteúdo (cabe em 2 dígitos no custom_id
// dos botões, em vez do nome inteiro) e o caminho de volta.
export function indiceDaClasse(nome: string): number {
  const chave = chaveFuncao(nome);
  return FUNCOES.findIndex((f) => chaveFuncao(f) === chave);
}

export function classeDoIndice(indice: number): string | null {
  const f = FUNCOES[indice];
  return f ? f.replace(/^:\w+:\s*/, "").trim() : null;
}

// Refaz as opções do dropdown a partir das vagas que a PT tem AGORA: uma opção por
// função, com "(Max N)" = quantas vagas dela existem. Funções novas (vaga agregada)
// entram; funções que não têm mais nenhuma vaga (vaga substituída) saem.
// Reaproveita valor/emoji das opções que já existiam.
export function recalcularOpcoes(
  opcoesAtuais: SelectOption[],
  linhas: string[],
  mapaEmojis: Map<string, EmojiResolvido>,
): SelectOption[] {
  const contagem = new Map<string, number>();
  for (const linha of linhas) {
    if (ehLinhaCriador(linha) || !/^\(\d+\/\d+\)/.test(linha.trim())) continue;
    const chave = chaveFuncao(linha);
    if (chave) contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }

  const existentes = new Map(opcoesAtuais.map((o) => [chaveFuncao(o.value), o]));
  const novas: SelectOption[] = [];
  for (const [chave, quantas] of contagem) {
    const existente = existentes.get(chave);
    const valor = existente?.value ?? FUNCOES.find((f) => chaveFuncao(f) === chave)?.trim();
    if (!valor) continue; // função desconhecida: não vira opção
    const { nome, emoji } = parseClasseComEmoji(valor, mapaEmojis);
    novas.push({
      label: `${nome} (Max ${quantas})`,
      value: valor,
      emoji: existente?.emoji ?? emojiParaComponente(emoji),
    });
  }
  return novas.sort((a, b) => compararClasses(a.value, b.value)).slice(0, MAX_OPCOES);
}
