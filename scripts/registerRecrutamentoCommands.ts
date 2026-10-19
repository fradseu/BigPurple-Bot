// registerRecrutamentoCommands.ts - Registra os slash commands do bot de
// RECRUTAMENTO (outro app do Discord, com outro token e outro Application ID).
// Roda local, 1x (ou quando a lista de comandos mudar). Atenção: PUT SUBSTITUI
// a lista inteira de comandos do app.
//
//   deno run --allow-net --allow-env --env-file=.env scripts/registerRecrutamentoCommands.ts
//
// .env (NÃO commitado):
//   RECRUTAMENTO_DISCORD_TOKEN=...
//   RECRUTAMENTO_APPLICATION_ID=...

const token = Deno.env.get("RECRUTAMENTO_DISCORD_TOKEN");
const applicationId = Deno.env.get("RECRUTAMENTO_APPLICATION_ID");

if (!token || !applicationId) {
  console.error(
    "Faltam RECRUTAMENTO_DISCORD_TOKEN e/ou RECRUTAMENTO_APPLICATION_ID. Crie um .env na raiz do projeto (veja o topo deste arquivo).",
  );
  Deno.exit(1);
}

const comandos = [
  {
    name: "recrutamento-painel",
    description: "Posta aqui o painel com o botão \"Solicitar ingresso\" (só administradores).",
    type: 1,
    // 32 = "Gerenciar Servidor": o comando já nasce escondido de quem não tem essa permissão.
    default_member_permissions: "32",
    // 0 = só dentro de servidor (não faz sentido em DM).
    contexts: [0],
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
