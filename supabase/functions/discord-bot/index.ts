// index.ts - Entrypoint HTTP da Edge Function. Todo clique, comando e modal
// do Discord chega AQUI como uma requisição POST avulsa (nada de conexão
// permanente/gateway, diferente do v1).
//
// (bump trivial pra testar o deploy automatico via GitHub Action - v2)
//
// Fluxo de toda requisição:
//   1. Verifica a assinatura Ed25519 (garante que veio mesmo do Discord)
//   2. Responde PING com PONG (obrigatório pro Discord aceitar o endpoint)
//   3. Roteia pro handler certo com base no tipo de interação + custom_id
//   4. Responde dentro de 3s (`immediate`) e, se precisar de mais trabalho,
//      deixa rodando em background via EdgeRuntime.waitUntil()
import { verifyKey } from "discord-interactions";
import { pong, reply } from "./discord/responses.ts";
import {
  ComponentType,
  DiscordInteraction,
  InteractionType,
} from "./discord/types.ts";
import { HandlerResult } from "./handlers/context.ts";
import { handleComandoConteudo } from "./handlers/comandoConteudo.ts";
import { handleTermos } from "./handlers/termos.ts";
// /diagnostico desativado por enquanto (deixa comentado, não apagado).
// import { handleDiagnostico } from "./handlers/diagnostico.ts";
import {
  handleBtnDefinirTitulo,
  handleBtnPasso2,
  handleConfigSelect,
  handleModalTitulo,
} from "./handlers/passo1.ts";
import {
  handleBotaoPasso2,
  handleBtnPasso3,
  handleSelectTierEspecifico,
} from "./handlers/passo2.ts";
import {
  handleAjusteQuantidade,
  handleFocarClasse,
  handleSelecionarClasses,
  handleVoltarClasses,
} from "./handlers/passo3.ts";
import { handleGerarPainelFinal } from "./handlers/painelFinal.ts";
import { handleVagaInscrever } from "./handlers/vagaInscrever.ts";
import { handleVagaDesistir } from "./handlers/vagaDesistir.ts";
import { handleVagaKickar } from "./handlers/vagaKickar.ts";
import { handleBonusToggle } from "./handlers/bonusToggle.ts";
import { handleSalaVozToggle } from "./handlers/salaVoz.ts";
import { PAGINA_PRIVACIDADE, PAGINA_TERMOS } from "./paginasLegais.ts";
import {
  ID_ABRIR_CATALOGO,
  lerAgregarOk,
  lerConfirmarConvite,
  lerMassa,
  lerMassaOk,
  lerMenuSubstituir,
  lerSelecaoCatalogo,
  lerSelecaoOutras,
  lerSelecaoRemocao,
  lerSubstituirOk,
  lerVoltarCatalogo,
} from "./domain/catalogo.ts";
import {
  handleAbrirCatalogo,
  handleConfirmarConvite,
  handleEnviarAgregar,
  handleEnviarMassa,
  handleEnviarSubstituir,
  handleMassa,
  handleMenuSubstituir,
  handleSelecionarCandidato,
  handleSelecionarOutra,
  handleSelecionarRemocao,
  handleVoltarCatalogo,
} from "./handlers/ptDisponiveis.ts";
import { inscreverJogadorNaPT, validarPedidoPreencher } from "./handlers/inscricaoInterna.ts";
import { enviarFollowUp } from "./discord/rest.ts";

const PUBLIC_KEY = Deno.env.get("DISCORD_PUBLIC_KEY") ?? "";

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

async function rotear(interaction: DiscordInteraction): Promise<HandlerResult> {
  if (interaction.type === InteractionType.ApplicationCommand) {
    switch (interaction.data?.name) {
      case "conteudo":
        return await handleComandoConteudo(interaction);
      case "termos":
        return handleTermos();
      // case "diagnostico":
      //   return await handleDiagnostico(interaction);
      default:
        return { immediate: reply("Comando desconhecido.", { ephemeral: true }) };
    }
  }

  if (interaction.type === InteractionType.ModalSubmit) {
    if (interaction.data?.custom_id === "modal_titulo") {
      return await handleModalTitulo(interaction);
    }
    return { immediate: reply("Modal desconhecido.", { ephemeral: true }) };
  }

  if (interaction.type === InteractionType.MessageComponent) {
    const customId = interaction.data?.custom_id ?? "";
    const componentType = interaction.data?.component_type;

    // --- Painel público (funciona pra qualquer jogador, sem exigir sessão de wizard) ---
    if (customId === "vaga_publica_inscrever") return handleVagaInscrever(interaction);
    if (customId === "vaga_publica_desistir") return handleVagaDesistir(interaction);
    if (customId === "vaga_publica_kickar") return handleVagaKickar(interaction);
    if (customId === "sala_voz_toggle") return handleSalaVozToggle(interaction);

    // --- Catálogo anônimo do Pool (líder da PT convida quem está disponível) ---
    if (customId === ID_ABRIR_CATALOGO) return handleAbrirCatalogo(interaction);
    const selecaoCatalogo = lerSelecaoCatalogo(customId);
    if (selecaoCatalogo) return handleSelecionarCandidato(interaction, selecaoCatalogo.ptMsgId);
    const voltarCatalogo = lerVoltarCatalogo(customId);
    if (voltarCatalogo) return handleVoltarCatalogo(interaction, voltarCatalogo.ptMsgId);
    const confirmarConvite = lerConfirmarConvite(customId);
    if (confirmarConvite) return handleConfirmarConvite(interaction, confirmarConvite);
    // 🟡 outras classes (agregar / substituir) e 📨 envio em massa
    const selecaoOutras = lerSelecaoOutras(customId);
    if (selecaoOutras) return handleSelecionarOutra(interaction, selecaoOutras.ptMsgId);
    const agregarOk = lerAgregarOk(customId);
    if (agregarOk) return handleEnviarAgregar(interaction, agregarOk);
    const menuSubstituir = lerMenuSubstituir(customId);
    if (menuSubstituir) return handleMenuSubstituir(interaction, menuSubstituir);
    const selecaoRemocao = lerSelecaoRemocao(customId);
    if (selecaoRemocao) return handleSelecionarRemocao(interaction, selecaoRemocao);
    const substituirOk = lerSubstituirOk(customId);
    if (substituirOk) return handleEnviarSubstituir(interaction, substituirOk);
    const massa = lerMassa(customId);
    if (massa) return handleMassa(interaction, massa.ptMsgId);
    const massaOk = lerMassaOk(customId);
    if (massaOk) return handleEnviarMassa(interaction, massaOk.ptMsgId);
    if (customId.startsWith("bonus_")) {
      return handleBonusToggle(interaction, customId.replace("bonus_", ""));
    }

    // --- Passo 1 ---
    if (customId === "btn_definir_titulo") return await handleBtnDefinirTitulo(interaction);
    if (
      componentType === ComponentType.StringSelect &&
      ["config_atividade", "config_cidade", "config_zona"].includes(customId)
    ) {
      return await handleConfigSelect(
        interaction,
        customId as "config_atividade" | "config_cidade" | "config_zona",
      );
    }
    if (customId === "btn_passo2") return await handleBtnPasso2(interaction);

    // --- Passo 2 ---
    if (["tier_true", "tier_false", "skip_true", "skip_false"].includes(customId)) {
      return await handleBotaoPasso2(interaction, customId as "tier_true" | "tier_false" | "skip_true" | "skip_false");
    }
    if (customId === "select_tier_especifico") return await handleSelectTierEspecifico(interaction);
    if (customId === "btn_passo3") return await handleBtnPasso3(interaction);

    // --- Passo 3 ---
    if (customId === "selecionar_classes_da_pt") return await handleSelecionarClasses(interaction);
    if (customId === "focar_classe_select") {
      return await handleFocarClasse(interaction, interaction.data?.values?.[0] ?? "");
    }
    if (customId === "painel_add_1" || customId === "painel_rem_1") {
      return await handleAjusteQuantidade(interaction, customId);
    }
    if (customId === "btn_voltar_classes") return await handleVoltarClasses(interaction);

    // --- Passo final ---
    if (customId === "btn_gerar_painel_final") return await handleGerarPainelFinal(interaction);

    return { immediate: reply("Componente desconhecido.", { ephemeral: true }) };
  }

  return { immediate: reply("Tipo de interação não suportado.", { ephemeral: true }) };
}

Deno.serve(async (req: Request) => {
  // Páginas legais (GET) — exigidas pelo Discord Developer Portal nos campos
  // "URL dos termos de serviço" e "URL da política de privacidade" do app.
  if (req.method === "GET") {
    const pathname = new URL(req.url).pathname;
    if (pathname.endsWith("/termos")) {
      return new Response(PAGINA_TERMOS, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    if (pathname.endsWith("/privacidade")) {
      return new Response(PAGINA_PRIVACIDADE, { headers: { "content-type": "text/html; charset=utf-8" } });
    }
    return new Response("Not Found", { status: 404 });
  }

  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405 });
  }

  // Rota INTERNA do bot de Pool: alguém aceitou um convite e precisa entrar na vaga da
  // PT. Só este bot edita o painel da PT (foi ele que postou). Protegida por segredo
  // compartilhado entre as functions; não é uma rota do Discord.
  if (new URL(req.url).pathname.endsWith("/internal/preencher")) {
    const esperado = Deno.env.get("PT_INTERNAL_SECRET") ?? "";
    const recebido = req.headers.get("x-internal-secret") ?? "";
    if (!esperado || !segredosIguais(esperado, recebido)) {
      return new Response("unauthorized", { status: 401 });
    }
    const pedido = validarPedidoPreencher(await req.json().catch(() => null));
    if (!pedido) return jsonResponse({ ok: false, motivo: "pedido_invalido" }, 400);
    try {
      const resultado = await inscreverJogadorNaPT(pedido);
      return jsonResponse(resultado, 200);
    } catch (err) {
      console.error("Erro ao preencher vaga a pedido do pool:", err);
      return jsonResponse({ ok: false, motivo: "erro" }, 500);
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
    const { immediate, background } = await rotear(interaction);

    if (background) {
      // Se o trabalho em background der erro, isso NÃO pode ficar silencioso
      // (a interação já foi confirmada — sem isso, a mensagem original fica
      // travada pra sempre, sem nenhum sinal do que aconteceu). Manda o erro
      // como um aviso ephemeral direto no Discord, igual já fazíamos pro modal
      // de título.
      const executarComCapturaDeErro = async () => {
        try {
          await background();
        } catch (err) {
          console.error("Erro no background():", err);
          try {
            await enviarFollowUp(interaction.application_id, interaction.token, {
              content: `⚠️ Erro interno ao processar sua ação:\n\`\`\`${
                err instanceof Error ? err.stack ?? err.message : String(err)
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
        // Fora do runtime do Supabase (ex: rodando local sem EdgeRuntime) —
        // roda sem bloquear a resposta, só sem a garantia de não ser cortado.
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
