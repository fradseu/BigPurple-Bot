// index.ts - Entrypoint do acompanhamento diário da guilda. Não é um bot do Discord: só uma rota
// interna, chamada pelo agendador (pg_cron) com segredo próprio. A resposta volta na hora (202)
// e o retrato é tirado em segundo plano, porque a API do Albion pode demorar.
import { tirarRetratos } from "./snapshot.ts";

// Comparação em tempo constante (não vaza, pelo tempo de resposta, quantos caracteres batem).
function segredosIguais(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diferenca = 0;
  for (let i = 0; i < a.length; i++) diferenca |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diferenca === 0;
}

Deno.serve((req: Request) => {
  if (req.method !== "POST" || !new URL(req.url).pathname.endsWith("/snapshot")) {
    return new Response("Not Found", { status: 404 });
  }

  const esperado = Deno.env.get("GUILDA_CRON_SECRET") ?? "";
  const recebido = req.headers.get("x-cron-secret") ?? "";
  if (!esperado || !segredosIguais(esperado, recebido)) {
    return new Response("unauthorized", { status: 401 });
  }

  const trabalho = tirarRetratos()
    .then((r) => console.log("Retrato da guilda:", JSON.stringify(r)))
    .catch((err) => console.error("Erro no retrato da guilda:", err));

  // deno-lint-ignore no-explicit-any
  const waitUntil = (globalThis as any).EdgeRuntime?.waitUntil;
  if (waitUntil) waitUntil(trabalho);

  return new Response(JSON.stringify({ iniciado: true }), {
    status: 202,
    headers: { "content-type": "application/json" },
  });
});
