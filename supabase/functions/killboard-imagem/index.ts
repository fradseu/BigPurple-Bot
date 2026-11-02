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
      const { data, error } = await db().from("killboard_eventos").select("evento").eq("event_id", id).maybeSingle();
      if (error) throw new Error(error.message);
      if (!data) return new Response("Not Found", { status: 404 });
      png = await desenharAbate((data as { evento: EventoCompleto }).evento);
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
