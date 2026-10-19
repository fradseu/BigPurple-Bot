// catalogo.ts - Catálogo anônimo de disponíveis do Pool, visto pelo líder da PT.
// Funções PURAS: recebem os dados já lidos e devolvem o que mostrar. O líder vê
// só pseudônimo (#M24), classe, tier e há quanto tempo a pessoa está disponível —
// o nick só aparece depois que ela aceita o convite.
import {
  ActionRowComponent,
  ButtonStyle,
  ComponentType,
  DiscordEmbed,
  SelectOption,
  actionRow,
} from "../discord/types.ts";
import { chaveFuncao, ehLinhaCriador } from "./vagas.ts";

const MAX_OPCOES_DISCORD = 25;

// "📋 **Atividade:** DG Grupo + Caçada" -> ["DG Grupo", "Caçada"]
export function extrairAtividadesDaPT(content: string): string[] {
  const m = content.match(/📋 \*\*Atividade:\*\*\s*(.+)/);
  if (!m) return [];
  return m[1].split("+").map((s) => s.trim()).filter(Boolean);
}

// Os detalhes da PT que vão no convite: tudo entre o título e a linha "💬 Escolha seu
// papel..." — atividade, ponto de encontro, ambiente, quando e requisitos. SEM a linha do
// criador (o convidado não vê quem é o líder). Linhas em branco das pontas são aparadas.
export function extrairDetalhesDaPT(content: string): string {
  const linhas = content.split("\n").slice(1); // a 1ª é o título
  const fim = linhas.findIndex((l) => l.startsWith("💬"));
  const miolo = (fim === -1 ? linhas : linhas.slice(0, fim)).filter((l) => !ehLinhaCriador(l));
  return miolo.join("\n").replace(/\n{3,}/g, "\n\n").trim();
}

export interface VagaAberta {
  chave: string; // comparável (sem emoji/acento de formato)
  rotulo: string; // como mostrar ("FURA-BRUMA")
}

// Nome legível da função numa linha de vaga ("(0/1) <:x:1> TANK " -> "TANK").
function rotuloDaLinha(linha: string): string {
  return linha
    .replace(/^\(\d+\/\d+\)\s*/, "")
    .replace(/<a?:\w+:\d+>\s*/g, "")
    .replace(/:\w+:\s*/g, "")
    .replace(/<@!?&?\d+>/g, "")
    .replace(/^[^\p{L}\p{N}]+/u, "") // emoji padrão no começo ("🛡️ TANK" -> "TANK")
    .replace(/\s+/g, " ")
    .trim();
}

// Funções que ainda têm vaga LIVRE (sem repetir). Linha livre = "(0/n)" sem menção.
export function vagasAbertas(linhas: string[]): VagaAberta[] {
  const vistas = new Set<string>();
  const abertas: VagaAberta[] = [];
  for (const linha of linhas) {
    if (ehLinhaCriador(linha)) continue;
    if (!/^\(0\/\d+\)/.test(linha.trim()) || /<@!?\d+>/.test(linha)) continue;
    const chave = chaveFuncao(linha);
    if (!chave || vistas.has(chave)) continue;
    vistas.add(chave);
    abertas.push({ chave, rotulo: rotuloDaLinha(linha) });
  }
  return abertas;
}

// A vaga dessa função ainda está livre AGORA? Usado ao confirmar um convite: o catálogo
// foi montado alguns segundos antes, e nesse meio tempo alguém pode ter ocupado a vaga.
export function vagaContinuaAberta(linhas: string[], classe: string): boolean {
  const chave = chaveFuncao(classe);
  return vagasAbertas(linhas).some((v) => v.chave === chave);
}

// IDs de quem já está na PT (menções "<@id>" nas linhas de vaga).
export function usuariosNaPT(linhas: string[]): Set<string> {
  const ids = new Set<string>();
  for (const linha of linhas) {
    if (ehLinhaCriador(linha)) continue;
    for (const m of linha.matchAll(/<@!?(\d+)>/g)) ids.add(m[1]);
  }
  return ids;
}

// canal da PT (ou o pai dele, se a PT mora num tópico) -> área do Pool (PVE/PVP/FAC/AVALON)
export function areaDaPT(
  canaisPossiveis: Array<string | null | undefined>,
  areasCanais: Record<string, string>,
): string | null {
  for (const id of canaisPossiveis) {
    if (id && areasCanais[id]) return areasCanais[id];
  }
  return null;
}

// O que vem do banco. `userId` serve SÓ pra excluir quem já está na PT / é o líder —
// nunca é mostrado (veja OpcaoCatalogo, que não o carrega).
export interface CandidatoBruto {
  id: string;
  userId: string;
  codigo: string;
  classes: string[];
  tier: string;
  areas: string[];
  criadoEmMs: number;
}

export interface OpcaoCatalogo {
  disponibilidadeId: string;
  codigo: string;
  classe: string; // rótulo da vaga pra qual seria convidado
  tier: string;
  areas: string[];
  minutosDisponivel: number;
}

// Cruza candidatos com as vagas abertas: um item por (candidato, vaga aberta que ele
// joga). Fora quem é o líder, quem já está na PT e quem já tem convite pendente.
export function montarCatalogo(params: {
  candidatos: CandidatoBruto[];
  abertas: VagaAberta[];
  liderId: string;
  naPT: Set<string>;
  jaConvidados: Set<string>; // ids de DISPONIBILIDADE com convite pendente nessa PT
  agoraMs: number;
}): OpcaoCatalogo[] {
  const { candidatos, abertas, liderId, naPT, jaConvidados, agoraMs } = params;
  const opcoes: OpcaoCatalogo[] = [];

  const ordenados = [...candidatos].sort((a, b) => a.criadoEmMs - b.criadoEmMs); // quem espera há mais tempo primeiro
  for (const c of ordenados) {
    if (c.userId === liderId || naPT.has(c.userId) || jaConvidados.has(c.id)) continue;
    const chavesDele = new Set(c.classes.map(chaveFuncao));
    for (const vaga of abertas) {
      if (!chavesDele.has(vaga.chave)) continue;
      opcoes.push({
        disponibilidadeId: c.id,
        codigo: c.codigo,
        classe: vaga.rotulo,
        tier: c.tier,
        areas: c.areas,
        minutosDisponivel: Math.max(0, Math.floor((agoraMs - c.criadoEmMs) / 60_000)),
      });
    }
  }
  return opcoes.slice(0, MAX_OPCOES_DISCORD);
}

// ---- IDs dos componentes (tudo "stateless": o que precisa lembrar vai no próprio ID)
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";

export const ID_ABRIR_CATALOGO = "pt_catalogo_abrir";
export const idSelecaoCatalogo = (ptMsgId: string) => `ptcat_sel:${ptMsgId}`;
export const idVoltarCatalogo = (ptMsgId: string) => `ptconv_voltar:${ptMsgId}`;
export const idConfirmarConvite = (dispId: string, ptMsgId: string, classe: string) =>
  `ptconv_ok:${dispId}:${ptMsgId}:${classe}`;

export function lerSelecaoCatalogo(customId: string): { ptMsgId: string } | null {
  const m = customId.match(/^ptcat_sel:(\d{15,25})$/);
  return m ? { ptMsgId: m[1] } : null;
}

export function lerVoltarCatalogo(customId: string): { ptMsgId: string } | null {
  const m = customId.match(/^ptconv_voltar:(\d{15,25})$/);
  return m ? { ptMsgId: m[1] } : null;
}

export function lerConfirmarConvite(
  customId: string,
): { dispId: string; ptMsgId: string; classe: string } | null {
  const m = customId.match(new RegExp(`^ptconv_ok:(${UUID}):(\\d{15,25}):(.{1,60})$`, "i"));
  return m ? { dispId: m[1], ptMsgId: m[2], classe: m[3] } : null;
}

// valor de cada opção da lista: "<id da disponibilidade>|<classe>|<código>"
export const valorOpcao = (o: OpcaoCatalogo) => `${o.disponibilidadeId}|${o.classe}|${o.codigo}`;

export function lerValorOpcao(valor: string): { dispId: string; classe: string; codigo: string } | null {
  const m = valor.match(new RegExp(`^(${UUID})\\|([^|]{1,60})\\|([A-Z0-9]{3})$`, "i"));
  return m ? { dispId: m[1], classe: m[2], codigo: m[3] } : null;
}

// ---- Telas (mensagem privada do líder)
const COR = 0x7b2cbf;

export function montarTelaCatalogo(
  opcoes: OpcaoCatalogo[],
  ptMsgId: string,
  aviso?: string,
): { content: string; embeds: DiscordEmbed[]; components: ActionRowComponent[] } {
  if (opcoes.length === 0) {
    return {
      content: "",
      embeds: [{
        title: "🔎 Disponíveis no Pool",
        description: aviso ?? "Ninguém disponível agora pra essa PT. Tente de novo daqui a pouco — o catálogo muda toda hora.",
        color: COR,
      }],
      components: [],
    };
  }

  const options: SelectOption[] = opcoes.map((o) => ({
    label: `#${o.codigo} · ${o.classe} · ${o.tier}`.slice(0, 100),
    value: valorOpcao(o),
    description: `${o.areas.join(", ")} · disponível há ${o.minutosDisponivel} min`.slice(0, 100),
  }));

  return {
    content: "",
    embeds: [{
      title: "🔎 Disponíveis no Pool",
      description: `${aviso ? `${aviso}\n\n` : ""}**${opcoes.length}** opção(ões) pra vagas abertas dessa PT. ` +
        `Você vê só um código — o nick aparece quando a pessoa **aceitar**. Escolha uma pra convidar:`,
      color: COR,
    }],
    components: [
      actionRow({
        type: ComponentType.StringSelect,
        custom_id: idSelecaoCatalogo(ptMsgId),
        placeholder: "Escolha quem convidar",
        options,
        min_values: 1,
        max_values: 1,
      }),
    ],
  };
}

export function montarTelaConfirmacao(
  codigo: string,
  classe: string,
  dispId: string,
  ptMsgId: string,
): { content: string; embeds: DiscordEmbed[]; components: ActionRowComponent[] } {
  return {
    content: "",
    embeds: [{
      title: "📨 Confirmar convite",
      description: `Convidar **#${codigo}** pra vaga de **${classe}**?\n\n` +
        `O convite chega só na caixa privada dela e some em **3 minutos**. ` +
        `Se ela recusar, você não é avisado de quem foi.`,
      color: COR,
    }],
    components: [
      actionRow(
        {
          type: ComponentType.Button,
          style: ButtonStyle.Success,
          label: "Convidar",
          emoji: { name: "📨" },
          custom_id: idConfirmarConvite(dispId, ptMsgId, classe),
        },
        {
          type: ComponentType.Button,
          style: ButtonStyle.Secondary,
          label: "Voltar",
          emoji: { name: "↩️" },
          custom_id: idVoltarCatalogo(ptMsgId),
        },
      ),
    ],
  };
}
