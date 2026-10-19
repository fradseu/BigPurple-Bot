// mensagemCandidatura.ts - Monta a mensagem que os recrutadores veem:
// embed do dossiê + botões Aprovar / Recusar / Atualizar / Killboard.
import { COR_PENDENTE, urlKillboardJogador } from "../config.ts";
import { Dossie, EventoResumo } from "../albion/dossie.ts";
import { CandidaturaRow } from "../db/client.ts";
import { listarAnteriores } from "../db/candidaturas.ts";
import { formatarFama } from "../domain/fama.ts";
import { PassagemGuilda } from "../domain/historico.ts";
import {
  actionRow,
  ActionRowComponent,
  ButtonComponent,
  ButtonStyle,
  ComponentType,
  DiscordEmbed,
  DiscordEmbedField,
} from "../discord/types.ts";

const LIMITE_FIELD = 1024;
const MAX_GUILDAS_LISTADAS = 5;

function limitar(texto: string, max: number): string {
  return texto.length <= max ? texto : `${texto.slice(0, max - 1)}…`;
}

const dataDiscord = (ms: number, estilo: "d" | "R" = "d") => `<t:${Math.floor(ms / 1000)}:${estilo}>`;

// { Royal: 46417876, Hellgate: 0 } -> "Royal 46,42m" (esconde o que é zero)
function listarNaoZeros(valores: Record<string, number>): string {
  const itens = Object.entries(valores)
    .filter(([, v]) => v > 0)
    .map(([nome, v]) => `${nome} ${formatarFama(v)}`);
  return itens.length > 0 ? itens.join(" · ") : "—";
}

function linhaGuilda(p: PassagemGuilda): string {
  const periodo = p.primeiraVez === p.ultimaVez || dataDiscord(p.primeiraVez) === dataDiscord(p.ultimaVez)
    ? dataDiscord(p.primeiraVez)
    : `${dataDiscord(p.primeiraVez)} → ${dataDiscord(p.ultimaVez)}`;
  return `**${p.guilda}** — ${periodo} (${p.eventos} ${p.eventos === 1 ? "evento" : "eventos"})`;
}

function linhaKill(e: EventoResumo): string {
  const guilda = e.guildaOponente ? ` (${e.guildaOponente})` : "";
  return `${dataDiscord(e.quando, "R")} — **${e.oponente}**${guilda} · ${formatarFama(e.fama)} fama`;
}

function linhaMorte(e: EventoResumo): string {
  const guilda = e.guildaOponente ? ` (${e.guildaOponente})` : "";
  return `${dataDiscord(e.quando, "R")} — por **${e.oponente}**${guilda}`;
}

function camposDoJogador(d: Dossie): DiscordEmbedField[] {
  const j = d.jogador;
  if (!j) return [];
  const campos: DiscordEmbedField[] = [];

  campos.push({
    name: "⚔️ Jogador",
    value: limitar(
      `**[${j.nome}](${urlKillboardJogador(j.id)})**\n` +
        `🏰 Guilda: **${j.guildaAtual ?? "sem guilda"}**` +
        (j.aliancaAtual ? ` · 🤝 Aliança: **${j.aliancaAtual}**` : ""),
      LIMITE_FIELD,
    ),
  });

  const f = j.fama;
  let linhaTotal = `**Total calculado: ${formatarFama(f.total)}**`;
  if (d.famaDeclarada !== null) {
    const diff = d.diferencaFamaPct !== null
      ? ` (${d.diferencaFamaPct >= 0 ? "+" : ""}${Math.round(d.diferencaFamaPct * 100)}%)`
      : "";
    linhaTotal += ` · declarado: **${formatarFama(d.famaDeclarada)}**${diff}`;
  }
  campos.push({
    name: "📊 Fama",
    value: limitar(
      `PvE ${formatarFama(f.pve)} · Coleta ${formatarFama(f.coleta)} · Craft ${formatarFama(f.craft)}\n` +
        `Pesca ${formatarFama(f.pesca)} · Fazenda ${formatarFama(f.fazenda)} · PvP ${formatarFama(f.pvp)}\n` +
        linhaTotal,
      LIMITE_FIELD,
    ),
  });

  const linhasDetalhe = [
    `**PvE:** ${listarNaoZeros(j.detalhes.pveZonas)}`,
    `**Coleta (recurso):** ${listarNaoZeros(j.detalhes.coletaTipos)}`,
    `**Coleta (zona):** ${listarNaoZeros(j.detalhes.coletaZonas)}`,
    `**Craft:** ${f.craft > 0 ? formatarFama(f.craft) : "—"}`,
  ];
  campos.push({
    name: "🧭 Fama detalhada",
    value: limitar(linhasDetalhe.join("\n"), LIMITE_FIELD),
  });

  campos.push({
    name: "🗡️ PvP",
    value: limitar(
      `Fama K/D: **${j.razaoFama.toLocaleString("pt-BR", { maximumFractionDigits: 2 })}** ` +
        `(kill ${formatarFama(f.pvp)} / morte ${formatarFama(j.deathFame)})\n` +
        `Eventos recentes: ${j.totalKills} kills · ${j.totalMortes} mortes\n` +
        `Última atividade: ${j.ultimaAtividade ? dataDiscord(j.ultimaAtividade, "R") : "nenhuma"}`,
      LIMITE_FIELD,
    ),
  });

  if (j.guildasVistas.length > 0) {
    const linhas = j.guildasVistas.slice(0, MAX_GUILDAS_LISTADAS).map(linhaGuilda);
    campos.push({
      name: "🏰 Guildas vistas (pelo killboard, recente → antigo)",
      value: limitar(linhas.join("\n"), LIMITE_FIELD),
    });
  }
  if (j.ultimasKills.length > 0) {
    campos.push({ name: "✅ Últimas kills", value: limitar(j.ultimasKills.map(linhaKill).join("\n"), LIMITE_FIELD) });
  }
  if (j.ultimasMortes.length > 0) {
    campos.push({ name: "💀 Últimas mortes", value: limitar(j.ultimasMortes.map(linhaMorte).join("\n"), LIMITE_FIELD) });
  }

  return campos;
}

export async function montarMensagemCandidatura(
  c: CandidaturaRow,
  dossie: Dossie | null,
): Promise<{ embed: DiscordEmbed; components: ActionRowComponent[] }> {
  const alertas = [...(dossie?.alertas ?? [])];

  // Candidaturas anteriores já decididas (mesmo Discord ou mesmo personagem).
  try {
    const anteriores = (await listarAnteriores(c.discord_user_id, dossie?.jogador?.id ?? null))
      .filter((a) => a.id !== c.id);
    for (const a of anteriores) {
      alertas.push(
        `Candidatura anterior **${a.status}** em ${dataDiscord(Date.parse(a.criado_em))} (nick: ${a.nickname}).`,
      );
    }
  } catch (err) {
    console.error("Erro ao listar candidaturas anteriores:", err);
  }

  let descricao =
    `👤 **Discord:** <@${c.discord_user_id}>\n` +
    `🎮 **Nick informado:** ${c.nickname}\n` +
    `💬 **Fama declarada:** ${c.fama_declarada}\n` +
    `📣 **Como conheceu a guilda:** ${limitar(c.como_conheceu, 300)}`;

  const campos: DiscordEmbedField[] = [];

  if (!dossie) {
    descricao += "\n\n⏳ Dossiê ainda não gerado.";
  } else if (dossie.status === "nao_encontrado") {
    descricao += "\n\n❌ **Nick não encontrado no Albion.**";
    if (dossie.similares.length > 0) {
      descricao += `\nParecidos: ${dossie.similares.map((s) => `\`${s}\``).join(", ")}`;
    }
  } else if (dossie.status === "api_indisponivel") {
    descricao += "\n\n⚠️ **API do Albion indisponível** — clique em 🔄 pra tentar o dossiê de novo.";
  } else {
    campos.push(...camposDoJogador(dossie));
  }

  const alertasParaMostrar = dossie?.status === "ok" ? alertas : alertas.filter((a) => !a.startsWith("Nick não encontrado"));
  campos.push({
    name: "🚩 Pontos de atenção",
    value: alertasParaMostrar.length > 0
      ? limitar(alertasParaMostrar.map((a) => `• ${a}`).join("\n"), LIMITE_FIELD)
      : "✅ Nada fora do comum.",
  });

  const embed: DiscordEmbed = {
    title: `📋 Candidatura — ${c.nickname}`,
    description: descricao,
    color: COR_PENDENTE,
    fields: campos,
    footer: {
      text: "Fonte: API oficial do Albion (Americas). Guildas = só as vistas no killboard (não é histórico completo e a API não diz se saiu ou foi expulso).",
    },
    timestamp: new Date(dossie?.geradoEm ?? Date.parse(c.criado_em)).toISOString(),
  };

  const botoes: ButtonComponent[] = [
    { type: ComponentType.Button, style: ButtonStyle.Success, label: "Aprovar", emoji: { name: "✅" }, custom_id: `rec_aprovar:${c.id}` },
    { type: ComponentType.Button, style: ButtonStyle.Danger, label: "Recusar", emoji: { name: "❌" }, custom_id: `rec_recusar:${c.id}` },
    { type: ComponentType.Button, style: ButtonStyle.Secondary, label: "Atualizar dossiê", emoji: { name: "🔄" }, custom_id: `rec_refresh:${c.id}` },
  ];
  if (dossie?.jogador) {
    botoes.push({
      type: ComponentType.Button,
      style: ButtonStyle.Link,
      label: "Killboard",
      url: urlKillboardJogador(dossie.jogador.id),
    });
  }

  return { embed, components: [actionRow(...botoes)] };
}
