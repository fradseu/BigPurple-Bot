// termos.ts - /termos (atende à exigência legal do Discord)
import { reply } from "../discord/responses.ts";
import { ButtonStyle, actionRow } from "../discord/types.ts";
import { HandlerResult } from "./context.ts";

export function handleTermos(): HandlerResult {
  const rowLinks = actionRow(
    {
      type: 2 as const,
      style: ButtonStyle.Link,
      label: "📄 Termos de Serviço",
      url: "https://github.com/fradseu/BigPurple-Bot/blob/main/TERMOS.md",
    },
    {
      type: 2 as const,
      style: ButtonStyle.Link,
      label: "🔒 Política de Privacidade",
      url: "https://github.com/fradseu/BigPurple-Bot/blob/main/PRIVACIDADE.md",
    },
  );

  return {
    immediate: reply(
      "⚖️ **Informações Legais do Bot**\n\nPara garantir a segurança dos dados e o uso correto das funcionalidades, disponibilizamos nossos documentos oficiais nos botões abaixo:",
      { ephemeral: true, components: [rowLinks] },
    ),
  };
}
