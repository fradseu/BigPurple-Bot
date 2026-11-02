// index.ts - Function `killboard-imagem` (pública, só leitura): GET /killboard-imagem/<eventId>.png
// devolve o card "Detalhes do abate" de uma kill que o killboard já guardou em killboard_eventos.
// O Discord baixa a imagem uma vez e guarda no cache dele; aqui também fica em memória.
import { createClient } from "@supabase/supabase-js";
import { desenharAbate, EventoCompleto } from "../_shared/killboard/imagem.ts";

const cache = new Map<number, Uint8Array>();

function db() {
  return createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
    auth: { persistSession: false },
  });
}

function base64(bytes: Uint8Array): string {
  let s = "";
  for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000));
  return btoa(s);
}

Deno.serve(async (req: Request) => {
  const url = new URL(req.url);
  const m = url.pathname.match(/\/(\d+)\.png$/);
  if (req.method !== "GET" || !m) return new Response("Not Found", { status: 404 });
  const id = Number(m[1]);

  try {
    let png = cache.get(id);
    if (!png) {
      const { data, error } = await db().from("killboard_eventos").select("evento, png_base64")
        .eq("event_id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return new Response("Not Found", { status: 404 });
      const linha = data as { evento: EventoCompleto; png_base64: string | null };
      if (linha.png_base64) {
        png = Uint8Array.from(atob(linha.png_base64), (c) => c.charCodeAt(0));
      } else {
        // Primeira vez: desenha (até 3 tentativas se algum ícone falhar) e guarda o PNG só se
        // estiver completo; incompleto, é servido mas desenhado de novo na próxima leitura.
        let r = await desenharAbate(linha.evento);
        for (let t = 2; t <= 3 && !r.completo; t++) {
          await new Promise((ok) => setTimeout(ok, 1_500 * t));
          r = await desenharAbate(linha.evento);
        }
        png = r.png;
        if (r.completo) {
          await db().from("killboard_eventos").update({ png_base64: base64(png) }).eq("event_id", id);
        } else {
          console.error("killboard-imagem", id, "card incompleto (ícone não carregou)");
        }
        if (!r.completo) {
          return new Response(png as unknown as BodyInit, { headers: { "content-type": "image/png", "cache-control": "no-store" } });
        }
      }
      if (cache.size > 200) cache.clear();
      cache.set(id, png);
    }
    // ?formato=base64: para conferir a imagem fora do Discord.
    if (url.searchParams.get("formato") === "base64") {
      return new Response(base64(png), { headers: { "content-type": "text/plain" } });
    }
    return new Response(png as unknown as BodyInit, {
      headers: { "content-type": "image/png", "cache-control": "public, max-age=31536000, immutable" },
    });
  } catch (err) {
    console.error("killboard-imagem", id, err);
    return new Response("erro ao desenhar", { status: 500 });
  }
});
