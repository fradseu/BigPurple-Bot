// interno.ts - Rota interna de manutenção: registra os slash commands deste bot usando o próprio
// DISCORD_TOKEN da function (sem precisar de computador). Protegida pelo segredo interno.
import { COMANDOS } from "../comandos.ts";

export { segredoInterno } from "../../_shared/killboard/segredo.ts";

export async function registrarComandos(): Promise<{ registrados: string[] }> {
  const headers = { Authorization: `Bot ${Deno.env.get("DISCORD_TOKEN")}`, "Content-Type": "application/json" };
  const app = await fetch("https://discord.com/api/v10/applications/@me", { headers });
  if (!app.ok) throw new Error(`Discord /applications/@me -> ${app.status}: ${await app.text()}`);
  const { id } = await app.json() as { id: string };
  const res = await fetch(`https://discord.com/api/v10/applications/${id}/commands`, {
    method: "PUT",
    headers,
    body: JSON.stringify(COMANDOS),
  });
  if (!res.ok) throw new Error(`Discord PUT commands -> ${res.status}: ${await res.text()}`);
  const r = await res.json() as Array<{ name: string }>;
  return { registrados: r.map((c) => `/${c.name}`) };
}
