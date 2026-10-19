// index.ts - Entrypoint HTTP do bot POOL. Mesmo modelo dos outros bots: cada
// clique/comando do Discord chega aqui como um POST avulso, com assinatura Ed25519.
// Além das interações, tem uma rota interna (POST /expirar) chamada pelo agendador.
import { verifyKey } from "discord-interactions";
import { pong, reply } from "./discord/responses.ts";
import { ComponentType, DiscordInteraction, InteractionType } from "./discord/types.ts";
import { enviarFollowUp } from "./discord/rest.ts";
import { HandlerResult } from "./handlers/context.ts";
import { handlePainel } from "./handlers/painel.ts";
import {
  ehCampoWizard,
  handleAbrirFormulario,
  handleCancelarFormulario,
  handleConfirmar,
  handleDuracao,
  handleRevisar,
  handleSair,
  handleSelecao,
  handleVoltar,
} from "./handlers/disponibilidade.ts";
import { expirarEAtualizarCaixas } from "./handlers/expiracao.ts";
import { handleResponderConvite } from "./handlers/convite.ts";
import { processarPedidoConvite } from "./handlers/convidar.ts";
import { criarCaixaParaMembro, validarPedidoCriarCaixa } from "./handlers/criarCaixa.ts";
import { sincronizarCaixas } from "./handlers/sincronizacao.ts";
import { lerBotaoConvite, validarPedidoConvite } from "./domain/convite.ts";

const PUBLIC_KEY = Deno.env.get("POOL_PUBLIC_KEY") ?? "";

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json" },
  });
}

// Comparação em tempo constante (não vaza, pelo tempo de resposta, quantos caracteres batem).
function segredosIguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

function rotear(interaction: DiscordInteraction): HandlerResult {
  if (interaction.type === InteractionType.ApplicationCommand) {
    if (interaction.data?.name === "pool-painel") return handlePainel(interaction);
    return { immediate: reply("Comando desconhecido.", { ephemeral: true }) };
  }

  if (interaction.type === InteractionType.MessageComponent) {
    const customId = interaction.data?.custom_id ?? "";

    const botaoConvite = lerBotaoConvite(customId);
    if (botaoConvite) {
      return handleResponderConvite(interaction, botaoConvite.acao, botaoConvite.conviteId);
    }

    if (customId === "pool_ficar") return handleAbrirFormulario(interaction);
    if (customId === "pool_sair") return handleSair(interaction);
    if (customId === "pool_confirmar") return handleConfirmar(interaction);
    if (customId === "pool_cancelar") return handleCancelarFormulario(interaction);
    if (customId === "pool_revisar") return handleRevisar(interaction);
    if (customId === "pool_voltar") return handleVoltar(interaction);
    if (customId.startsWith("pool_dur:")) return handleDuracao(interaction, customId.slice("pool_dur:".length));

    if (interaction.data?.component_type === ComponentType.StringSelect && customId.startsWith("pool_sel:")) {
      const campo = customId.slice("pool_sel:".length);
      if (ehCampoWizard(campo)) return handleSelecao(interaction, campo);
    }

    return { immediate: reply("Componente desconhecido.", { ephemeral: true }) };
  }

  return { immediate: reply("Tipo de interação não suportado.", { ephemeral: true }) };
}

Deno.serve(async (req: Request) => {
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Rota interna do agendador: protegida por segredo próprio (não é do Discord).
  if (new URL(req.url).pathname.endsWith("/expirar")) {
    const esperado = Deno.env.get("POOL_CRON_SECRET") ?? "";
    const recebido = req.headers.get("x-cron-secret") ?? "";
    if (!esperado || !segredosIguais(esperado, recebido)) {
      return new Response("unauthorized", { status: 401 });
    }
    try {
      return jsonResponse(await expirarEAtualizarCaixas());
    } catch (err) {
      console.error("Erro na expiração:", err);
      return jsonResponse({ erro: "falha ao expirar" }, 500);
    }
  }

  // Rota interna do bot de RECRUTAMENTO: alguém foi aprovado e já deve ter a caixa pronta.
  // Mesmo segredo compartilhado entre as functions. Também repara uma caixa sem painel.
  if (new URL(req.url).pathname.endsWith("/criar-caixa")) {
    const esperado = Deno.env.get("PT_INTERNAL_SECRET") ?? "";
    const recebido = req.headers.get("x-internal-secret") ?? "";
    if (!esperado || !segredosIguais(esperado, recebido)) {
      return new Response("unauthorized", { status: 401 });
    }
    const pedido = validarPedidoCriarCaixa(await req.json().catch(() => null));
    if (!pedido) return jsonResponse({ ok: false, motivo: "pedido_invalido" }, 400);
    return jsonResponse(await criarCaixaParaMembro(pedido.guildId, pedido.userId));
  }

  // Varredura periódica (pg_cron): cria a caixa de quem é Membro e ainda não tem.
  if (new URL(req.url).pathname.endsWith("/sincronizar")) {
    const esperado = Deno.env.get("POOL_CRON_SECRET") ?? "";
    const recebido = req.headers.get("x-cron-secret") ?? "";
    if (!esperado || !segredosIguais(esperado, recebido)) {
      return new Response("unauthorized", { status: 401 });
    }
    try {
      return jsonResponse(await sincronizarCaixas());
    } catch (err) {
      console.error("Erro na sincronização de caixas:", err);
      return jsonResponse({ erro: "falha na sincronização" }, 500);
    }
  }

  // Rota interna do bot de CONTEÚDO: o líder escolheu alguém no catálogo. Segredo
  // compartilhado entre as functions (PT_INTERNAL_SECRET). Responde só o status de cada
  // item — nunca quem é a pessoa.
  if (new URL(req.url).pathname.endsWith("/convidar")) {
    const esperado = Deno.env.get("PT_INTERNAL_SECRET") ?? "";
    const recebido = req.headers.get("x-internal-secret") ?? "";
    if (!esperado || !segredosIguais(esperado, recebido)) {
      return new Response("unauthorized", { status: 401 });
    }
    const pedido = validarPedidoConvite(await req.json().catch(() => null));
    if (!pedido) return jsonResponse({ erro: "pedido inválido" }, 400);
    try {
      return jsonResponse(await processarPedidoConvite(pedido));
    } catch (err) {
      console.error("Erro ao processar convites:", err);
      return jsonResponse({ erro: "falha ao processar convites" }, 500);
    }
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
