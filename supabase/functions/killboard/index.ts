// index.ts - Function `killboard`: só rotas internas, chamadas pelo pg_cron (não é endpoint do
// Discord). Fica separada do discord-bot pra rodar sem depender do app de interações.
//   POST /internal/killboard  — a cada 5 min: posta eventos novos dos Membros
//   POST /internal/ranking    — toda segunda: posta o top 10 dos últimos 30 dias
//   POST /internal/estrutura  — {"guild_id"}: categorias, canais e cargos do servidor (só leitura)
// Todas exigem o header x-cron-secret (segredo interno, ver _shared/killboard/segredo.ts).
import { estruturaDoServidor, postarRankings, rodarKillboard } from "../_shared/killboard/rodada.ts";
import { segredoInterno, segredosIguais } from "../_shared/killboard/segredo.ts";

function json(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

Deno.serve(async (req: Request) => {
  const caminho = new URL(req.url).pathname;
  if (req.method !== "POST" || !/\/internal\/(killboard|ranking|estrutura)$/.test(caminho)) {
    return new Response("Not Found", { status: 404 });
  }

  const esperado = await segredoInterno();
  if (!esperado || !segredosIguais(esperado, req.headers.get("x-cron-secret") ?? "")) {
    return new Response("unauthorized", { status: 401 });
  }

  try {
    if (caminho.endsWith("/estrutura")) {
      const { guild_id } = await req.json().catch(() => ({})) as { guild_id?: string };
      if (!guild_id) return json({ erro: "guild_id obrigatório" }, 400);
      return json(await estruturaDoServidor(guild_id));
    }
    // A API do Albion pode demorar mais que o tempo limite do pg_net: responde na hora (202) e
    // termina em segundo plano. O resultado vai pro log da function.
    const trabalho = (caminho.endsWith("/ranking") ? postarRankings() : rodarKillboard())
      .then((r) => console.log(caminho, JSON.stringify(r)))
      .catch((err) => console.error(caminho, err));
    // deno-lint-ignore no-explicit-any
    const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil;
    if (waitUntil) waitUntil(trabalho);
    else await trabalho;
    return json({ iniciado: true }, 202);
  } catch (err) {
    console.error(caminho, err);
    return json({ erro: err instanceof Error ? err.message : String(err) }, 500);
  }
});
