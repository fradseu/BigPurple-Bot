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


// Candidatos cujas classes NÃO têm vaga livre na PT: só dá pra convidar CRIANDO uma vaga
// (agregar) ou trocando uma vaga livre (substituir). Um item por (candidato, classe dele).
export function montarOutrasClasses(params: {
  candidatos: CandidatoBruto[];
  abertas: VagaAberta[];
  liderId: string;
  naPT: Set<string>;
  jaConvidados: Set<string>;
  agoraMs: number;
}): OpcaoCatalogo[] {
  const { candidatos, abertas, liderId, naPT, jaConvidados, agoraMs } = params;
  const chavesAbertas = new Set(abertas.map((v) => v.chave));
  const opcoes: OpcaoCatalogo[] = [];

  const ordenados = [...candidatos].sort((a, b) => a.criadoEmMs - b.criadoEmMs);
  for (const c of ordenados) {
    if (c.userId === liderId || naPT.has(c.userId) || jaConvidados.has(c.id)) continue;
    const vistas = new Set<string>();
    for (const classe of c.classes) {
      const chave = chaveFuncao(classe);
      if (!chave || chavesAbertas.has(chave) || vistas.has(chave)) continue; // classe COM vaga livre não entra aqui
      vistas.add(chave);
      opcoes.push({
        disponibilidadeId: c.id,
        codigo: c.codigo,
        classe: classe.trim(),
        tier: c.tier,
        areas: c.areas,
        minutosDisponivel: Math.max(0, Math.floor((agoraMs - c.criadoEmMs) / 60_000)),
      });
    }
  }
  return opcoes.slice(0, MAX_OPCOES_DISCORD);
}

// Convite EM MASSA: só pra quem joga a classe de uma vaga que está livre (nunca pra "outras
// classes", que exigem decisão 1 por 1). UM convite por pessoa (a primeira vaga que casa),
// até `max` por envio — o resto exige outro envio, que o anti-flood limita.
export const MAX_CONVITES_EM_MASSA = 5;

export function selecionarParaMassa(opcoes: OpcaoCatalogo[], max = MAX_CONVITES_EM_MASSA): OpcaoCatalogo[] {
  const jaTem = new Set<string>();
  const escolhidas: OpcaoCatalogo[] = [];
  for (const o of opcoes) {
    if (jaTem.has(o.disponibilidadeId)) continue;
    jaTem.add(o.disponibilidadeId);
    escolhidas.push(o);
    if (escolhidas.length >= max) break;
  }
  return escolhidas;
}

// ---- IDs dos componentes (tudo "stateless": o que precisa lembrar vai no próprio ID).
// A classe vai como ÍNDICE na lista do criador de conteúdo (2 dígitos) pra caber nos 100
// caracteres do custom_id; o caminho de volta é classeDoIndice().
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}";
const SNOW = "\\d{15,25}";

export const ID_ABRIR_CATALOGO = "pt_catalogo_abrir";
export const idSelecaoCatalogo = (ptMsgId: string) => `ptcat_sel:${ptMsgId}`;
export const idSelecaoOutras = (ptMsgId: string) => `ptcat_outra:${ptMsgId}`;
export const idVoltarCatalogo = (ptMsgId: string) => `ptconv_voltar:${ptMsgId}`;
export const idConfirmarConvite = (dispId: string, ptMsgId: string, classe: string) =>
  `ptconv_ok:${dispId}:${ptMsgId}:${classe}`;
export const idMassa = (ptMsgId: string) => `ptmass:${ptMsgId}`;
export const idMassaOk = (ptMsgId: string) => `ptmassok:${ptMsgId}`;
export const idAgregarOk = (dispId: string, ptMsgId: string, ci: number) => `ptagrok:${dispId}:${ptMsgId}:${ci}`;
// Os 3 do fluxo "substituir" carregam também o CÓDIGO da pessoa (3 caracteres), pra a tela
// seguinte mostrar "#M24" sem consultar o banco.
export const idMenuSubstituir = (dispId: string, ptMsgId: string, ci: number, codigo: string) =>
  `ptsubm:${dispId}:${ptMsgId}:${ci}:${codigo}`;
export const idSelecaoRemocao = (dispId: string, ptMsgId: string, ci: number, codigo: string) =>
  `ptsub:${dispId}:${ptMsgId}:${ci}:${codigo}`;
export const idSubstituirOk = (dispId: string, ptMsgId: string, ci: number, cr: number, codigo: string) =>
  `ptsubok:${dispId}:${ptMsgId}:${ci}:${cr}:${codigo}`;

const soPT = (prefixo: string, customId: string): { ptMsgId: string } | null => {
  const m = customId.match(new RegExp(`^${prefixo}:(${SNOW})$`));
  return m ? { ptMsgId: m[1] } : null;
};
export const lerSelecaoCatalogo = (id: string) => soPT("ptcat_sel", id);
export const lerSelecaoOutras = (id: string) => soPT("ptcat_outra", id);
export const lerVoltarCatalogo = (id: string) => soPT("ptconv_voltar", id);
export const lerMassa = (id: string) => soPT("ptmass", id);
export const lerMassaOk = (id: string) => soPT("ptmassok", id);

export function lerConfirmarConvite(
  customId: string,
): { dispId: string; ptMsgId: string; classe: string } | null {
  const m = customId.match(new RegExp(`^ptconv_ok:(${UUID}):(${SNOW}):(.{1,60})$`, "i"));
  return m ? { dispId: m[1], ptMsgId: m[2], classe: m[3] } : null;
}

const comClasse = (prefixo: string, customId: string): { dispId: string; ptMsgId: string; ci: number } | null => {
  const m = customId.match(new RegExp(`^${prefixo}:(${UUID}):(${SNOW}):(\\d{1,2})$`, "i"));
  return m ? { dispId: m[1], ptMsgId: m[2], ci: Number(m[3]) } : null;
};
export const lerAgregarOk = (id: string) => comClasse("ptagrok", id);

const comClasseECodigo = (
  prefixo: string,
  customId: string,
): { dispId: string; ptMsgId: string; ci: number; codigo: string } | null => {
  const m = customId.match(new RegExp(`^${prefixo}:(${UUID}):(${SNOW}):(\\d{1,2}):([A-Z0-9]{3})$`, "i"));
  return m ? { dispId: m[1], ptMsgId: m[2], ci: Number(m[3]), codigo: m[4] } : null;
};
export const lerMenuSubstituir = (id: string) => comClasseECodigo("ptsubm", id);
export const lerSelecaoRemocao = (id: string) => comClasseECodigo("ptsub", id);

export function lerSubstituirOk(
  customId: string,
): { dispId: string; ptMsgId: string; ci: number; cr: number; codigo: string } | null {
  const m = customId.match(
    new RegExp(`^ptsubok:(${UUID}):(${SNOW}):(\\d{1,2}):(\\d{1,2}):([A-Z0-9]{3})$`, "i"),
  );
  return m ? { dispId: m[1], ptMsgId: m[2], ci: Number(m[3]), cr: Number(m[4]), codigo: m[5] } : null;
}

// valor de cada opção da lista: "<id da disponibilidade>|<classe>|<código>"
export const valorOpcao = (o: OpcaoCatalogo) => `${o.disponibilidadeId}|${o.classe}|${o.codigo}`;

export function lerValorOpcao(valor: string): { dispId: string; classe: string; codigo: string } | null {
  const m = valor.match(new RegExp(`^(${UUID})\\|([^|]{1,60})\\|([A-Z0-9]{3})$`, "i"));
  return m ? { dispId: m[1], classe: m[2], codigo: m[3] } : null;
}

// ---- Telas (mensagem privada do líder)
const COR = 0x7b2cbf;

interface Tela {
  content: string;
  embeds: DiscordEmbed[];
  components: ActionRowComponent[];
}

const botao = (
  customId: string,
  label: string,
  emoji: string,
  style: ButtonStyle,
): ActionRowComponent["components"][number] => ({
  type: ComponentType.Button,
  style,
  label,
  emoji: { name: emoji },
  custom_id: customId,
});

function lista(
  customId: string,
  placeholder: string,
  opcoes: OpcaoCatalogo[],
): ActionRowComponent["components"][number] {
  const options: SelectOption[] = opcoes.map((o) => ({
    label: `#${o.codigo} · ${o.classe} · ${o.tier}`.slice(0, 100),
    value: valorOpcao(o),
    description: `${o.areas.join(", ")} · disponível há ${o.minutosDisponivel} min`.slice(0, 100),
  }));
  return {
    type: ComponentType.StringSelect,
    custom_id: customId,
    placeholder,
    options,
    min_values: 1,
    max_values: 1,
  };
}

export function montarTelaCatalogo(params: {
  abertas: OpcaoCatalogo[]; // classe com vaga livre
  outras: OpcaoCatalogo[]; // classe SEM vaga livre
  ptMsgId: string;
  qtdMassa?: number; // quantas pessoas o envio em massa alcançaria
  aviso?: string;
}): Tela {
  const { abertas, outras, ptMsgId, qtdMassa = 0, aviso } = params;

  if (abertas.length === 0 && outras.length === 0) {
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

  const linhas = [
    abertas.length > 0
      ? `🟢 **Vaga aberta (${abertas.length}):** joga a classe de uma vaga livre — dá pra convidar **em massa**.`
      : null,
    outras.length > 0
      ? `🟡 **Outras classes (${outras.length}):** convite **1 por 1**, criando uma vaga nova (agregar) ou trocando uma vaga livre (substituir).`
      : null,
    `Você vê só um código — o nick aparece quando a pessoa **aceitar**.`,
  ].filter(Boolean).join("\n");

  const componentes: ActionRowComponent[] = [];
  if (abertas.length > 0) componentes.push(actionRow(lista(idSelecaoCatalogo(ptMsgId), "🟢 Vaga aberta: quem convidar", abertas)));
  if (outras.length > 0) componentes.push(actionRow(lista(idSelecaoOutras(ptMsgId), "🟡 Outras classes (1 por 1)", outras)));
  if (qtdMassa > 0) {
    componentes.push(
      actionRow(botao(idMassa(ptMsgId), `Convidar todos (${qtdMassa})`, "📨", ButtonStyle.Primary)),
    );
  }

  return {
    content: "",
    embeds: [{
      title: "🔎 Disponíveis no Pool",
      description: `${aviso ? `${aviso}\n\n` : ""}${linhas}`,
      color: COR,
    }],
    components: componentes,
  };
}

// Convite pra uma vaga que JÁ EXISTE e está livre (a classe da pessoa casa).
export function montarTelaConfirmacao(codigo: string, classe: string, dispId: string, ptMsgId: string): Tela {
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
        botao(idConfirmarConvite(dispId, ptMsgId, classe), "Convidar", "📨", ButtonStyle.Success),
        botao(idVoltarCatalogo(ptMsgId), "Voltar", "↩️", ButtonStyle.Secondary),
      ),
    ],
  };
}

// Classe da pessoa SEM vaga livre: agregar ou substituir?
export function montarTelaEscolhaOutra(
  codigo: string,
  classe: string,
  dispId: string,
  ptMsgId: string,
  ci: number,
): Tela {
  return {
    content: "",
    embeds: [{
      title: "🟡 Classe sem vaga livre",
      description: `**#${codigo}** joga **${classe}**, mas essa PT não tem vaga livre pra ela. O que fazer?\n\n` +
        `➕ **Agregar:** cria uma vaga nova pra ela — a PT **cresce**.\n` +
        `🔄 **Substituir:** cria a vaga dela e **apaga uma vaga livre** que você escolher — a PT mantém o tamanho.\n\n` +
        `A vaga só é criada se a pessoa **aceitar** o convite.`,
      color: COR,
    }],
    components: [
      actionRow(
        botao(idAgregarOk(dispId, ptMsgId, ci), "Agregar vaga", "➕", ButtonStyle.Success),
        botao(idMenuSubstituir(dispId, ptMsgId, ci, codigo), "Substituir uma vaga livre", "🔄", ButtonStyle.Primary),
        botao(idVoltarCatalogo(ptMsgId), "Voltar", "↩️", ButtonStyle.Secondary),
      ),
    ],
  };
}

// Substituir: qual vaga LIVRE apagar? (`livres` já vem com o índice da função na lista.)
export function montarTelaMenuSubstituir(params: {
  codigo: string;
  classe: string;
  dispId: string;
  ptMsgId: string;
  ci: number;
  livres: Array<{ rotulo: string; indice: number }>;
}): Tela {
  const { codigo, classe, dispId, ptMsgId, ci, livres } = params;

  if (livres.length === 0) {
    return {
      content: "",
      embeds: [{
        title: "🔄 Substituir",
        description: "Não há nenhuma vaga livre pra apagar. Use **Agregar** pra criar a vaga dela.",
        color: COR,
      }],
      components: [
        actionRow(
          botao(idAgregarOk(dispId, ptMsgId, ci), "Agregar vaga", "➕", ButtonStyle.Success),
          botao(idVoltarCatalogo(ptMsgId), "Voltar", "↩️", ButtonStyle.Secondary),
        ),
      ],
    };
  }

  const options: SelectOption[] = livres.map((l) => ({
    label: `Apagar uma vaga livre de ${l.rotulo}`.slice(0, 100),
    value: String(l.indice),
  }));
  return {
    content: "",
    embeds: [{
      title: "🔄 Substituir",
      description: `Pra criar a vaga de **${classe}** (#${codigo}) mantendo o tamanho da PT, qual vaga **livre** você quer apagar?`,
      color: COR,
    }],
    components: [
      actionRow({
        type: ComponentType.StringSelect,
        custom_id: idSelecaoRemocao(dispId, ptMsgId, ci, codigo),
        placeholder: "Escolha a vaga livre a apagar",
        options,
        min_values: 1,
        max_values: 1,
      }),
      actionRow(botao(idVoltarCatalogo(ptMsgId), "Voltar", "↩️", ButtonStyle.Secondary)),
    ],
  };
}

export function montarTelaConfirmarSubstituir(params: {
  codigo: string;
  classe: string;
  remover: string;
  dispId: string;
  ptMsgId: string;
  ci: number;
  cr: number;
}): Tela {
  const { codigo, classe, remover, dispId, ptMsgId, ci, cr } = params;
  return {
    content: "",
    embeds: [{
      title: "📨 Confirmar substituição",
      description: `Convidar **#${codigo}** pra uma vaga nova de **${classe}**, **apagando uma vaga livre de ${remover}**?\n\n` +
        `Só acontece se a pessoa **aceitar**. O convite chega na caixa privada dela e some em **3 minutos**.`,
      color: COR,
    }],
    components: [
      actionRow(
        botao(idSubstituirOk(dispId, ptMsgId, ci, cr, codigo), "Convidar", "📨", ButtonStyle.Success),
        botao(idVoltarCatalogo(ptMsgId), "Voltar", "↩️", ButtonStyle.Secondary),
      ),
    ],
  };
}

export function montarTelaMassa(itens: Array<{ codigo: string; classe: string }>, ptMsgId: string): Tela {
  return {
    content: "",
    embeds: [{
      title: "📨 Convidar todos com vaga aberta",
      description: `Convidar estas **${itens.length}** pessoas, cada uma pra vaga livre da sua classe:\n\n` +
        itens.map((i) => `• **#${i.codigo}** · ${i.classe}`).join("\n") +
        `\n\n⏳ Isso conta como **1 tentativa** de envio. Cada PT tem **1 envio a cada 5 minutos** e ` +
        `**no máximo 5 tentativas** — depois disso, é no chat. Cada convite vale 3 minutos.`,
      color: COR,
    }],
    components: [
      actionRow(
        botao(idMassaOk(ptMsgId), "Enviar convites", "📨", ButtonStyle.Success),
        botao(idVoltarCatalogo(ptMsgId), "Voltar", "↩️", ButtonStyle.Secondary),
      ),
    ],
  };
}

// ---- O que dizer ao líder depois de tentar enviar
export interface RespostaEnvio {
  resultados: Array<{ status: string }>;
  bloqueio?: { motivo: "limite" | "espere"; esperaSeg: number; tentativas: number };
  tentativas?: { usadas: number; max: number };
}

export function formatarEspera(segundos: number): string {
  const min = Math.floor(segundos / 60);
  const seg = segundos % 60;
  if (min === 0) return `${seg} s`;
  return seg === 0 ? `${min} min` : `${min} min ${seg} s`;
}

const MOTIVO_SEM_ENVIO: Record<string, string> = {
  indisponivel: "já não está mais disponível",
  ja_convidado: "já foi convidada pra essa PT",
  limite: "ficou de fora (muitos convites pendentes nessa PT)",
  erro: "não consegui entregar agora",
};

export function resumirEnvio(resp: RespostaEnvio | null): string {
  if (!resp) return "⚠️ Não consegui falar com o Pool agora. Tente de novo em instantes.";

  if (resp.bloqueio?.motivo === "limite") {
    return `🚫 Você já usou as **${resp.bloqueio.tentativas}** tentativas de convite desta PT. ` +
      `A partir daqui é no chat mesmo! 😄`;
  }
  if (resp.bloqueio?.motivo === "espere") {
    return `⏳ Aguarde **${formatarEspera(resp.bloqueio.esperaSeg)}** pra enviar novos convites desta PT ` +
      `(limite: 1 envio a cada 5 minutos — evita flood). Tentativas usadas: ${resp.bloqueio.tentativas}/5.`;
  }

  const contagem: Record<string, number> = {};
  for (const r of resp.resultados) contagem[r.status] = (contagem[r.status] ?? 0) + 1;
  const enviados = contagem["enviado"] ?? 0;

  const falhas = Object.entries(contagem)
    .filter(([status]) => status !== "enviado")
    .map(([status, n]) => `${n} ${n === 1 ? "pessoa" : "pessoas"}: ${MOTIVO_SEM_ENVIO[status] ?? status}`);

  if (enviados === 0) {
    return `😕 Nenhum convite foi enviado.${falhas.length ? `\n• ${falhas.join("\n• ")}` : ""}`;
  }

  let texto = `📨 **${enviados}** ${enviados === 1 ? "convite enviado" : "convites enviados"}! ` +
    `Cada um vale **3 minutos**. Quem aceitar entra na PT e o painel mostra o nome.`;
  if (falhas.length) texto += `\n\nNão enviados:\n• ${falhas.join("\n• ")}`;
  if (resp.tentativas) {
    texto += `\n\n🧮 Tentativas de envio desta PT: **${resp.tentativas.usadas}/${resp.tentativas.max}** ` +
      `— o próximo só daqui a 5 minutos.`;
  }
  return texto;
}
