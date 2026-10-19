// convite.ts - Regras puras dos convites: validade, a mensagem que aparece na caixa
// da pessoa e a validação do pedido que o bot de conteúdo manda pra cá.
import { COR_ROXO } from "../config.ts";
import {
  actionRow,
  ActionRowComponent,
  AllowedMentions,
  ButtonStyle,
  ComponentType,
  DiscordEmbed,
} from "../discord/types.ts";

export const CONVITE_TTL_MIN = 3;
export const MAX_CONVITES_POR_PEDIDO = 5;
export const MAX_CONVITES_PENDENTES_POR_PT = 5;

export function calcularExpiracaoConvite(agoraMs: number): Date {
  return new Date(agoraMs + CONVITE_TTL_MIN * 60_000);
}

// ---- IDs dos botões: "pool_aceitar:<uuid>" / "pool_recusar:<uuid>"
export type AcaoConvite = "aceitar" | "recusar";

export function idBotaoConvite(acao: AcaoConvite, conviteId: string): string {
  return `pool_${acao}:${conviteId}`;
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function lerBotaoConvite(customId: string): { acao: AcaoConvite; conviteId: string } | null {
  const m = customId.match(/^pool_(aceitar|recusar):(.+)$/);
  if (!m || !UUID.test(m[2])) return null;
  return { acao: m[1] as AcaoConvite, conviteId: m[2] };
}

// ---- A mensagem do convite (aparece só na caixa privada da pessoa)
export function montarConvite(params: {
  conviteId: string;
  candidatoUserId: string;
  liderUserId: string;
  ptTitulo: string;
  classe: string;
  expiraEmMs: number;
}): {
  content: string;
  embeds: DiscordEmbed[];
  components: ActionRowComponent[];
  allowed_mentions: AllowedMentions;
} {
  const quando = Math.floor(params.expiraEmMs / 1000);
  return {
    // A menção dentro da caixa (só ela e o bot veem) é o que gera a notificação.
    content: `<@${params.candidatoUserId}> 🎯 você recebeu um convite!`,
    embeds: [{
      title: "🎯 Convite para PT",
      description: `**${params.ptTitulo}**\n` +
        `👑 Líder: <@${params.liderUserId}>\n` +
        `🛡️ Vaga: **${params.classe}**\n\n` +
        `⏳ Este convite some <t:${quando}:R>.\n` +
        `Seu nick só aparece pra o líder se você **aceitar**. Se recusar, ninguém fica sabendo.`,
      color: COR_ROXO,
    }],
    components: [
      actionRow(
        {
          type: ComponentType.Button,
          style: ButtonStyle.Success,
          label: "Aceitar",
          emoji: { name: "✅" },
          custom_id: idBotaoConvite("aceitar", params.conviteId),
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Secondary,
          label: "Recusar",
          emoji: { name: "❌" },
          custom_id: idBotaoConvite("recusar", params.conviteId),
        },
      ),
    ],
    allowed_mentions: { users: [params.candidatoUserId] },
  };
}

// ---- Pedido interno (bot de conteúdo -> pool): POST /convidar
export interface PedidoConvite {
  guild_id: string;
  pt_canal_id: string;
  pt_mensagem_id: string;
  pt_titulo: string;
  lider_user_id: string;
  itens: Array<{ disponibilidade_id: string; classe: string }>;
}

const SNOWFLAKE = /^\d{15,25}$/;

// Valida o JSON recebido (nunca confiar no formato, mesmo vindo de outra function).
export function validarPedidoConvite(bruto: unknown): PedidoConvite | null {
  if (!bruto || typeof bruto !== "object") return null;
  const o = bruto as Record<string, unknown>;

  const texto = (v: unknown, max: number) =>
    typeof v === "string" && v.trim().length > 0 && v.length <= max ? v.trim() : null;
  const snowflake = (v: unknown) => typeof v === "string" && SNOWFLAKE.test(v) ? v : null;

  const guild_id = snowflake(o.guild_id);
  const pt_canal_id = snowflake(o.pt_canal_id);
  const pt_mensagem_id = snowflake(o.pt_mensagem_id);
  const lider_user_id = snowflake(o.lider_user_id);
  const pt_titulo = texto(o.pt_titulo, 200);
  if (!guild_id || !pt_canal_id || !pt_mensagem_id || !lider_user_id || !pt_titulo) return null;

  if (!Array.isArray(o.itens) || o.itens.length === 0 || o.itens.length > MAX_CONVITES_POR_PEDIDO) return null;
  const itens: PedidoConvite["itens"] = [];
  for (const item of o.itens) {
    if (!item || typeof item !== "object") return null;
    const i = item as Record<string, unknown>;
    const classe = texto(i.classe, 60);
    if (typeof i.disponibilidade_id !== "string" || !UUID.test(i.disponibilidade_id) || !classe) return null;
    itens.push({ disponibilidade_id: i.disponibilidade_id, classe });
  }

  return { guild_id, pt_canal_id, pt_mensagem_id, pt_titulo, lider_user_id, itens };
}

export type StatusItemConvite = "enviado" | "indisponivel" | "ja_convidado" | "limite" | "erro";

export interface ResultadoItemConvite {
  disponibilidade_id: string;
  status: StatusItemConvite;
}
