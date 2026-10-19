// aprovacao.ts - Regras puras do que acontece quando uma candidatura é aprovada:
// qual apelido o membro recebe e como explicar, em português, por que algo falhou.

const LIMITE_APELIDO_DISCORD = 32;

// O apelido é o nick DO JOGO. Se o dossiê achou o jogador no Albion, usa o nome
// exatamente como o jogo escreve (maiúsculas/minúsculas certas, mesmo que a
// pessoa tenha digitado "felipepikito"). Se não achou, cai no que ela digitou.
export function nomeNoJogo(
  candidatura: { nickname: string; dossie: Record<string, unknown> | null },
): string {
  const dossie = candidatura.dossie;
  if (dossie && dossie.status === "ok") {
    const jogador = dossie.jogador as { nome?: unknown } | null | undefined;
    if (jogador && typeof jogador.nome === "string" && jogador.nome.trim() !== "") {
      return jogador.nome.trim();
    }
  }
  return candidatura.nickname.trim();
}

// O Discord recusa apelido com mais de 32 caracteres.
export function apelidoParaMembro(nome: string): string {
  return nome.trim().slice(0, LIMITE_APELIDO_DISCORD);
}

export type AcaoDiscord = "apelido" | "cargo";

// Erros do Discord (já embrulhados em "Discord REST ... -> 403: {...code: 50013}")
// viram uma frase que o recrutador entende e sabe como resolver.
export function traduzirErroDiscord(mensagemErro: string, acao: AcaoDiscord): string {
  const quem = acao === "apelido" ? "mudar o apelido" : "dar o cargo";

  if (mensagemErro.includes("10007") || mensagemErro.includes("Unknown Member")) {
    return `Não consegui ${quem}: a pessoa não está mais no servidor.`;
  }
  if (mensagemErro.includes("10011") || mensagemErro.includes("Unknown Role")) {
    return `Não consegui ${quem}: o cargo configurado não existe mais (use /recrutamento-config membro).`;
  }
  if (mensagemErro.includes("50013") || mensagemErro.includes("Missing Permissions")) {
    return acao === "apelido"
      ? "Não consegui mudar o apelido: o bot precisa da permissão **Gerenciar Apelidos** e o cargo dele " +
        "precisa estar **acima** do cargo da pessoa. (O Discord também não deixa ninguém mudar o apelido do dono do servidor.)"
      : "Não consegui dar o cargo: o bot precisa da permissão **Gerenciar Cargos** e o cargo dele " +
        "precisa estar **acima** do cargo de Membro na lista de cargos do servidor.";
  }
  return `Não consegui ${quem} (erro inesperado do Discord).`;
}
