// imagem.ts - Desenha o card "Detalhes do abate" no estilo do registro do jogo: matador à esquerda,
// vítima à direita, cada um com o equipamento na grade do jogo (3x3 + montaria), e a fama embaixo.
// Ícones: render oficial do Albion (com qualidade e quantidade). Fonte: Alegreya SC (Google Fonts).
import { decode, Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { createClient } from "@supabase/supabase-js";

const URL_FONTE = "https://raw.githubusercontent.com/google/fonts/main/ofl/alegreyasc/AlegreyaSC-Bold.ttf";

interface Item {
  Type: string;
  Count?: number;
  Quality?: number;
}

export interface JogadorCompleto {
  Name: string;
  GuildName?: string | null;
  AverageItemPower?: number;
  Equipment?: Record<string, Item | null> | null;
}

export interface EventoCompleto {
  EventId: number;
  TimeStamp: string;
  TotalVictimKillFame?: number;
  numberOfParticipants?: number;
  Killer: JogadorCompleto;
  Victim: JogadorCompleto;
}

// Grade igual à do jogo; a última linha só tem a montaria, no meio.
const GRADE: Array<Array<string | null>> = [
  ["Bag", "Head", "Cape"],
  ["MainHand", "Armor", "OffHand"],
  ["Potion", "Shoes", "Food"],
  [null, "Mount", null],
];

const cor = (hex: number) => hex >>> 0;
const PERGAMINHO = cor(0xe9d8b4ff);
const BORDA = cor(0x7a5a33ff);
const PAINEL = cor(0xf4e8cdff);
const PAINEL_VITIMA = cor(0xeed6c4ff);
const BORDA_PAINEL = cor(0xb89b6aff);
const SLOT_VAZIO = cor(0xdcc9a3ff);
const TINTA = cor(0x3b2a1aff);
const TINTA_SUAVE = cor(0x6b5235ff);
const SELO = cor(0x7a5a33ff);
const BRANCO = cor(0xfff8e8ff);

const LARGURA = 1000;
const ALTURA = 660;
const ICONE = 76;
const ESPACO = 6;

let fonte: Promise<Uint8Array> | null = null;
function carregarFonte(): Promise<Uint8Array> {
  if (!fonte) {
    fonte = fetch(URL_FONTE).then(async (r) => {
      if (!r.ok) throw new Error(`fonte: HTTP ${r.status}`);
      return new Uint8Array(await r.arrayBuffer());
    });
    fonte.catch(() => (fonte = null));
  }
  return fonte;
}

async function texto(conteudo: string, tamanho: number, corTexto: number): Promise<Image> {
  return await Image.renderText(await carregarFonte(), tamanho, conteudo, corTexto);
}

function caixa(img: Image, x: number, y: number, w: number, h: number, preenchimento: number, borda?: number) {
  if (borda !== undefined) {
    img.drawBox(x, y, w, h, borda);
    img.drawBox(x + 2, y + 2, w - 4, h - 4, preenchimento);
  } else {
    img.drawBox(x, y, w, h, preenchimento);
  }
}

function db() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

function paraBase64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

function deBase64(b64: string): Uint8Array {
  return Uint8Array.from(atob(b64), (c) => c.charCodeAt(0));
}

// PNG do ícone: 1º o cache do banco; senão o render oficial. Pedimos o ícone SEM parâmetros
// (quality/size): esse vem do cache do servidor deles e responde mesmo quando o backend do Albion
// está instável. O tamanho é ajustado aqui.
async function pngDoItem(tipo: string): Promise<Uint8Array | null> {
  const { data } = await db().from("killboard_icones").select("png_base64").eq("tipo", tipo).maybeSingle();
  if (data) return deBase64((data as { png_base64: string }).png_base64);

  const url = `https://render.albiononline.com/v1/item/${encodeURIComponent(tipo)}.png`;
  for (let tentativa = 1; tentativa <= 3; tentativa++) {
    try {
      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (res.ok) {
        const bytes = new Uint8Array(await res.arrayBuffer());
        await db().from("killboard_icones").upsert({ tipo, png_base64: paraBase64(bytes) });
        return bytes;
      }
      console.error("ícone", tipo, "HTTP", res.status, "tentativa", tentativa);
    } catch (err) {
      console.error("ícone", tipo, err instanceof Error ? err.message : String(err), "tentativa", tentativa);
    }
    await new Promise((r) => setTimeout(r, 800 * tentativa));
  }
  return null;
}

async function icone(item: Item): Promise<Image | null> {
  const bytes = await pngDoItem(item.Type);
  if (!bytes) return null;
  try {
    const img = await decode(bytes) as Image;
    return img.width === ICONE ? img : img.resize(ICONE, ICONE);
  } catch (err) {
    console.error("ícone", item.Type, "decode", err instanceof Error ? err.message : String(err));
    return null;
  }
}

// Roda `fn` em todos os itens, `n` por vez.
async function emLotes<T, R>(itens: T[], n: number, fn: (item: T) => Promise<R>): Promise<R[]> {
  const saida: R[] = [];
  for (let i = 0; i < itens.length; i += n) saida.push(...await Promise.all(itens.slice(i, i + n).map(fn)));
  return saida;
}

async function painel(
  img: Image,
  j: JogadorCompleto,
  x: number,
  y: number,
  w: number,
  h: number,
  fundo: number,
): Promise<number> {
  caixa(img, x, y, w, h, fundo, BORDA_PAINEL);

  const nome = await texto(j.Name, 30, TINTA);
  img.composite(nome, x + 20, y + 14);
  const guilda = await texto(j.GuildName ? j.GuildName : "sem guilda", 22, TINTA_SUAVE);
  img.composite(guilda, x + 20, y + 52);
  const ip = await texto(`IP ${Math.round(j.AverageItemPower ?? 0)}`, 22, TINTA_SUAVE);
  img.composite(ip, x + 20, y + 80);

  const larguraGrade = 3 * ICONE + 2 * ESPACO;
  const gx = x + Math.round((w - larguraGrade) / 2);
  const gy = y + 118;
  const icones = await emLotes(GRADE.flat(), 4, (slot) => {
    const item = slot ? j.Equipment?.[slot] : null;
    return item?.Type ? icone(item) : Promise.resolve(null);
  });
  let faltaram = 0;
  GRADE.flat().forEach((slot, i) => {
    if (!slot) return;
    const cx = gx + (i % 3) * (ICONE + ESPACO);
    const cy = gy + Math.floor(i / 3) * (ICONE + ESPACO);
    const ic = icones[i];
    if (ic) img.composite(ic, cx, cy);
    else caixa(img, cx + 4, cy + 4, ICONE - 8, ICONE - 8, SLOT_VAZIO);
    // Espaço com item que não carregou (diferente de espaço vazio de verdade).
    if (!ic && j.Equipment?.[slot]?.Type) faltaram++;
  });
  return faltaram;
}

function dataUtc(iso: string): string {
  const d = new Date(iso);
  const p = (n: number) => String(n).padStart(2, "0");
  return `${p(d.getUTCDate())}/${p(d.getUTCMonth() + 1)}/${d.getUTCFullYear()} ` +
    `${p(d.getUTCHours())}:${p(d.getUTCMinutes())} UTC`;
}

// `completo` = false quando algum ícone não carregou (o card não deve ser guardado como pronto).
export async function desenharAbate(e: EventoCompleto): Promise<{ png: Uint8Array; completo: boolean }> {
  const img = new Image(LARGURA, ALTURA);
  img.fill(BORDA);
  caixa(img, 8, 8, LARGURA - 16, ALTURA - 16, PERGAMINHO);

  const titulo = await texto("Detalhes do abate", 42, TINTA);
  img.composite(titulo, 40, 22);
  const assist = Math.max(0, (e.numberOfParticipants ?? 1) - 1);
  const sub = await texto(
    `${dataUtc(e.TimeStamp)}  ·  ${assist} assistência${assist === 1 ? "" : "s"}`,
    22,
    TINTA_SUAVE,
  );
  img.composite(sub, 40, 74);

  const pw = 400;
  const ph = 470;
  const py = 112;
  const faltaram = await painel(img, e.Killer, 40, py, pw, ph, PAINEL) +
    await painel(img, e.Victim, LARGURA - 40 - pw, py, pw, ph, PAINEL_VITIMA);

  // Selo "ABATEU" no meio.
  const selo = await texto("ABATEU", 24, BRANCO);
  const sw = selo.width + 28;
  const sx = Math.round(LARGURA / 2 - sw / 2);
  const sy = py + Math.round(ph / 2) - 22;
  caixa(img, sx, sy, sw, 44, SELO);
  img.composite(selo, sx + 14, sy + Math.round((44 - selo.height) / 2));

  // Fama embaixo, centralizada.
  const fama = (e.TotalVictimKillFame ?? 0).toLocaleString("pt-BR");
  const rotulo = await texto(`Fama de abate  ${fama}`, 28, TINTA);
  const fw = rotulo.width + 48;
  const fx = Math.round(LARGURA / 2 - fw / 2);
  const fy = ALTURA - 66;
  caixa(img, fx, fy, fw, 46, cor(0xf0c96aff), BORDA);
  img.composite(rotulo, fx + 24, fy + Math.round((46 - rotulo.height) / 2));

  return { png: await img.encode(), completo: faltaram === 0 };
}
