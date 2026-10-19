// registerPoolCommands.ts - Registra os slash commands do bot POOL (terceiro app
// do Discord, com token e Application ID próprios). Roda local, 1x (ou quando a
// lista de comandos mudar). Atenção: PUT SUBSTITUI a lista inteira do app.
//
//   deno run --allow-net --allow-env --env-file=.env scripts/registerPoolCommands.ts
//
// .env (NÃO commitado):
//   POOL_DISCORD_TOKEN=...
//   POOL_APPLICATION_ID=...

const token = Deno.env.get("POOL_DISCORD_TOKEN");
const applicationId = Deno.env.get("POOL_APPLICATION_ID");

if (!token || !applicationId) {
  console.error(
    "Faltam POOL_DISCORD_TOKEN e/ou POOL_APPLICATION_ID. Crie um .env na raiz do projeto (veja o topo deste arquivo).",
  );
  Deno.exit(1);
}

const comandos = [
  {
    name: "pool-painel",
    description: "Posta aqui o painel do Pool de conteúdo e define este canal como o pool (só administradores).",
    type: 1,
    // 8 = Administrador: o comando já nasce escondido de quem não tem essa permissão.
    default_member_permissions: "8",
    contexts: [0], // 0 = só dentro de servidor
  },
];

const res = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
  method: "PUT",
  headers: { Authorization: `Bot ${token}`, "Content-Type": "application/json" },
  body: JSON.stringify(comandos),
});

if (!res.ok) {
  console.error(`Falhou (${res.status}):`, await res.text());
  Deno.exit(1);
}

const registrados = await res.json() as Array<{ name: string }>;
console.log(`✅ ${registrados.length} comando(s) registrado(s):`, registrados.map((c) => c.name).join(", "));
