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

const LIMITE_DETALHES = 1500;

// Os detalhes da PT (atividade, ponto de encontro, ambiente, quando, requisitos) vêm
// do texto do painel. Aqui garantimos que NADA que identifique o líder passe pro convite,
// mesmo que o bot de conteúdo mande a mais: some a linha do criador, qualquer menção
// <@id>/<@&id> e os @everyone/@here (pra o convite nunca marcar ninguém).
export function sanitizarDetalhes(texto: string): string {
  return texto
    .split("\n")
    .filter((linha) => !linha.includes("👑") && !/criador/i.test(linha))
    .join("\n")
    .replace(/<@!?&?\d+>/g, "")
    .replace(/@(everyone|here)/gi, "$1")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, LIMITE_DETALHES);
}

// ---- A mensagem do convite (aparece só na caixa privada da pessoa)
// Mostra O QUE está sendo oferecido (PT, detalhes, vaga) e NÃO quem convida: o líder
// e a pessoa só se conhecem se ela aceitar e entrar na PT.
export function montarConvite(params: {
  conviteId: string;
  candidatoUserId: string;
  ptTitulo: string;
  ptDetalhes?: string;
  classe: string;
  expiraEmMs: number;
}): {
  content: string;
  embeds: DiscordEmbed[];
  components: ActionRowComponent[];
  allowed_mentions: AllowedMentions;
} {
  const quando = Math.floor(params.expiraEmMs / 1000);
  const detalhes = params.ptDetalhes ? sanitizarDetalhes(params.ptDetalhes) : "";
  return {
    // A menção dentro da caixa (só ela e o bot veem) é o que gera a notificação.
    content: `<@${params.candidatoUserId}> 🎯 você recebeu um convite!`,
    embeds: [{
      title: "🎯 Convite para PT",
      description: `**${params.ptTitulo}**\n` +
        (detalhes ? `${detalhes}\n\n` : "\n") +
        `🛡️ **Vaga para você: ${params.classe}**\n\n` +
        `⏳ Este convite some <t:${quando}:R>.\n` +
        `Se **aceitar**, você entra na PT e seu nome aparece no painel. Se recusar, ninguém fica sabendo.`,
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
  pt_detalhes: string; // texto do painel (sem o criador) — já sanitizado aqui
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

  // Opcional: se vier lixo/tipo errado, segue sem detalhes em vez de recusar o pedido.
  const pt_detalhes = typeof o.pt_detalhes === "string" ? sanitizarDetalhes(o.pt_detalhes) : "";

  return { guild_id, pt_canal_id, pt_mensagem_id, pt_titulo, pt_detalhes, lider_user_id, itens };
}

export type StatusItemConvite = "enviado" | "indisponivel" | "ja_convidado" | "limite" | "erro";

export interface ResultadoItemConvite {
  disponibilidade_id: string;
  status: StatusItemConvite;
}
