// index.ts - Entrypoint HTTP do bot de RECRUTAMENTO. Mesmo modelo do bot de
// conteúdo: cada clique/comando/modal do Discord chega aqui como um POST avulso.
//
//   1. Verifica a assinatura Ed25519 (garante que veio mesmo do Discord)
//   2. Responde PING com PONG (obrigatório pro Discord aceitar o endpoint)
//   3. Roteia pro handler certo (tipo de interação + custom_id)
//   4. Responde em até 3s (`immediate`); o trabalho pesado roda em background
//      via EdgeRuntime.waitUntil(), e qualquer erro dele vira aviso no Discord.
import { verifyKey } from "discord-interactions";
import { pong, reply } from "./discord/responses.ts";
import { DiscordInteraction, InteractionType } from "./discord/types.ts";
import { enviarFollowUp } from "./discord/rest.ts";
import { HandlerResult } from "./handlers/context.ts";
import { handlePainel } from "./handlers/painel.ts";
import { handleConfig } from "./handlers/configuracao.ts";
import {
  handleAbrirFormulario,
  handleEnviarFormulario,
  ID_MODAL_FORMULARIO,
} from "./handlers/formulario.ts";
import { handleAtualizarDossie, handleDecisao } from "./handlers/decisao.ts";

const PUBLIC_KEY = Deno.env.get("RECRUTAMENTO_PUBLIC_KEY") ?? "";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

function rotear(interaction: DiscordInteraction): HandlerResult {
  if (interaction.type === InteractionType.ApplicationCommand) {
    if (interaction.data?.name === "recrutamento-painel") return handlePainel(interaction);
    if (interaction.data?.name === "recrutamento-config") return handleConfig(interaction);
    return { immediate: reply("Comando desconhecido.", { ephemeral: true }) };
  }

  if (interaction.type === InteractionType.ModalSubmit) {
    if (interaction.data?.custom_id === ID_MODAL_FORMULARIO) {
      return handleEnviarFormulario(interaction);
    }
    return { immediate: reply("Formulário desconhecido.", { ephemeral: true }) };
  }

  if (interaction.type === InteractionType.MessageComponent) {
    const customId = interaction.data?.custom_id ?? "";

    if (customId === "rec_abrir_form") return handleAbrirFormulario();

    // Botões da candidatura vêm como "rec_acao:<id da candidatura>"
    const [acao, candidaturaId] = customId.split(":");
    if (candidaturaId) {
      if (acao === "rec_aprovar") return handleDecisao(interaction, "aprovada", candidaturaId);
      if (acao === "rec_recusar") return handleDecisao(interaction, "recusada", candidaturaId);
      if (acao === "rec_refresh") return handleAtualizarDossie(interaction, candidaturaId);
    }

    return { immediate: reply("Componente desconhecido.", { ephemeral: true }) };
  }

  return { immediate: reply("Tipo de interação não suportado.", { ephemeral: true }) };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  const signature = req.headers.get("x-signature-ed25519");
  const timestamp = req.headers.get("x-signature-timestamp");
  const rawBody = await req.text();

  const assinaturaValida =
    signature && timestamp && (await verifyKey(rawBody, signature, timestamp, PUBLIC_KEY));

  if (!assinaturaValida) {
    return new Response("invalid request signature", { status: 401 });
  }

  const interaction = JSON.parse(rawBody) as DiscordInteraction;

  if (interaction.type === InteractionType.Ping) {
    return jsonResponse(pong());
  }

  try {
    const { immediate, background } = rotear(interaction);

    if (background) {
      // Erro no background não pode ficar silencioso (a interação já foi
      // confirmada): vira um aviso ephemeral com o erro, direto no Discord.
      const executarComCapturaDeErro = async () => {
        try {
          await background();
        } catch (err) {
          console.error("Erro no background():", err);
          try {
            await enviarFollowUp(interaction.application_id, interaction.token, {
              content: `⚠️ Erro interno ao processar sua ação:\n\`\`\`${
                (err instanceof Error ? err.stack ?? err.message : String(err)).slice(0, 1800)
              }\`\`\``,
              flags: 64,
            });
          } catch (err2) {
            console.error("Erro ao avisar sobre falha do background:", err2);
          }
        }
      };

      // deno-lint-ignore no-explicit-any
      const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil;
      if (waitUntil) {
        waitUntil(executarComCapturaDeErro());
      } else {
        executarComCapturaDeErro();
      }
    }

    return jsonResponse(immediate);
  } catch (err) {
    console.error("Erro ao rotear interação:", err);
    return jsonResponse(
      reply(`⚠️ Erro interno: ${err instanceof Error ? err.message : String(err)}`, {
        ephemeral: true,
      }),
    );
  }
});
