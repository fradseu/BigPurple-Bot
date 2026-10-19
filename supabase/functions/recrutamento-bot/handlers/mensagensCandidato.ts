// mensagensCandidato.ts - O que o CANDIDATO lê (só ele vê, são respostas privadas).
// Texto separado do fluxo pra ficar fácil de ajustar o tom sem mexer na lógica.
import { COR_PENDENTE, NOME_GUILDA } from "../config.ts";
import { PayloadMensagem } from "../discord/rest.ts";

// Candidatura enviada com sucesso.
export function mensagemCandidaturaRecebida(nickname: string): PayloadMensagem {
  return {
    embeds: [{
      title: "🎉 Candidatura recebida!",
      description: `Obrigado pelo interesse na **${NOME_GUILDA}**, **${nickname}**! 💜\n\n` +
        `Sua candidatura está **em avaliação** pelos nossos recrutadores. ` +
        `Assim que alguém analisar, um recrutador entra em contato com você aqui no Discord.\n\n` +
        `📌 Não precisa enviar de novo — é só aguardar.`,
      color: COR_PENDENTE,
      fields: [
        { name: "🎮 Nick informado", value: nickname, inline: true },
        { name: "📋 Situação", value: "⏳ Em avaliação", inline: true },
      ],
    }],
  };
}

// A pessoa tentou enviar outra candidatura enquanto a primeira ainda está pendente.
export function mensagemJaEmAvaliacao(): PayloadMensagem {
  return {
    embeds: [{
      title: "⏳ Você já tem uma candidatura em avaliação",
      description: `Sua candidatura na **${NOME_GUILDA}** já foi recebida e está com os recrutadores. ` +
        `Não precisa enviar de novo — um recrutador entra em contato com você assim que analisar. 💜`,
      color: COR_PENDENTE,
    }],
  };
}

// O servidor ainda não foi configurado por um administrador.
export function mensagemNaoConfigurado(): PayloadMensagem {
  return {
    content: "⚠️ O recrutamento ainda não foi configurado neste servidor (falta o canal dos recrutadores). " +
      "Peça a um administrador pra usar `/recrutamento-config canal`.",
  };
}
