// listarDiscord.ts - Fotografa a estrutura do servidor do Discord (categorias, canais e cargos)
// num arquivo JSON, para planejar onde encaixar novas seções (ex.: "Ferramentas Big Purple").
// Só LÊ: não cria, edita nem apaga nada. Não lê mensagens.
//
// Como rodar (a partir da raiz do projeto, "BigPurple-Bot"):
//   deno run --allow-net --allow-env --allow-write --env-file=.env scripts/listarDiscord.ts <ID_DO_SERVIDOR>
//
// Usa o DISCORD_TOKEN do .env (o mesmo do registerCommands.ts). O bot precisa estar no servidor.
// Gera discord-estrutura.json na raiz (já está no .gitignore? se não, não commite).

const token = Deno.env.get("DISCORD_TOKEN");
const guildId = Deno.args[0];
if (!token || !guildId) {
  console.error("Uso: ... scripts/listarDiscord.ts <ID_DO_SERVIDOR>  (com DISCORD_TOKEN no .env)");
  Deno.exit(1);
}

async function api<T>(caminho: string): Promise<T> {
  const res = await fetch(`https://discord.com/api/v10${caminho}`, {
    headers: { Authorization: `Bot ${token}` },
  });
  if (!res.ok) throw new Error(`${caminho} -> ${res.status}: ${await res.text()}`);
  return await res.json() as T;
}

interface Canal {
  id: string;
  name: string;
  type: number;
  position: number;
  parent_id?: string | null;
  topic?: string | null;
  permission_overwrites?: Array<{ id: string; type: number; allow: string; deny: string }>;
}
interface Cargo {
  id: string;
  name: string;
  position: number;
  color: number;
  managed: boolean;
  permissions: string;
}

const TIPOS: Record<number, string> = {
  0: "texto",
  2: "voz",
  4: "categoria",
  5: "anúncios",
  13: "palco",
  15: "fórum",
  16: "mídia",
};

const [servidor, canais, cargos] = await Promise.all([
  api<{ name: string; member_count?: number }>(`/guilds/${guildId}?with_counts=true`),
  api<Canal[]>(`/guilds/${guildId}/channels`),
  api<Cargo[]>(`/guilds/${guildId}/roles`),
]);

const nomeCargo = new Map(cargos.map((c) => [c.id, c.name]));
const resumoPermissoes = (c: Canal) =>
  (c.permission_overwrites ?? []).map((o) => ({
    alvo: o.type === 0 ? `cargo:${nomeCargo.get(o.id) ?? o.id}` : `usuario:${o.id}`,
    allow: o.allow,
    deny: o.deny,
  }));

const categorias = canais.filter((c) => c.type === 4).sort((a, b) => a.position - b.position);
const filhos = (pai: string | null) =>
  canais.filter((c) => c.type !== 4 && (c.parent_id ?? null) === pai).sort((a, b) => a.position - b.position)
    .map((c) => ({
      id: c.id,
      nome: c.name,
      tipo: TIPOS[c.type] ?? String(c.type),
      topico: c.topic ?? undefined,
      permissoes: resumoPermissoes(c),
    }));

const estrutura = {
  servidor: servidor.name,
  membros: servidor.member_count,
  gerado_em: new Date().toISOString(),
  sem_categoria: filhos(null),
  categorias: categorias.map((cat) => ({
    id: cat.id,
    nome: cat.name,
    permissoes: resumoPermissoes(cat),
    canais: filhos(cat.id),
  })),
  cargos: cargos.sort((a, b) => b.position - a.position).map((c) => ({
    id: c.id,
    nome: c.name,
    posicao: c.position,
    de_bot: c.managed,
    permissoes: c.permissions,
  })),
};

await Deno.writeTextFile("discord-estrutura.json", JSON.stringify(estrutura, null, 2));
console.log(
  `✅ discord-estrutura.json gerado: ${categorias.length} categorias, ${canais.length} canais, ${cargos.length} cargos.`,
);
