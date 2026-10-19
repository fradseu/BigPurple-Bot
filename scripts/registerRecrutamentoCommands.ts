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

// Os dois comandos aparecem pra todo mundo no seletor DE PROPÓSITO: quem pode
// usar é decidido DENTRO do bot (administrador + os autorizados por ele, guardados
// no Supabase). Se escondêssemos do seletor (default_member_permissions), uma
// pessoa autorizada que não é administradora nem veria o comando.
// Quem não tem permissão recebe uma recusa privada.
//
// Tipos de opção do Discord: 1 = subcomando, 6 = usuário, 7 = canal, 8 = cargo.
const comandos = [
  {
    name: "recrutamento-painel",
    description: "Posta aqui o painel com o botão \"Solicitar ingresso\" (administradores e autorizados).",
    type: 1,
    contexts: [0], // 0 = só dentro de servidor (não faz sentido em DM)
  },
  {
    name: "recrutamento-config",
    description: "Configura o recrutamento deste servidor (administradores e autorizados).",
    type: 1,
    contexts: [0],
    options: [
      {
        type: 1,
        name: "canal",
        description: "Canal onde as candidaturas (dossiês) vão aparecer para os recrutadores.",
        options: [{
          type: 7,
          name: "canal",
          description: "Canal de texto dos recrutadores",
          required: true,
          channel_types: [0, 5], // texto e anúncios
        }],
      },
      {
        type: 1,
        name: "cargo",
        description: "Cargo dos recrutadores: é notificado e pode aprovar/recusar candidaturas.",
        options: [{ type: 8, name: "cargo", description: "Cargo @Recrutador", required: true }],
      },
      {
        type: 1,
        name: "autorizar",
        description: "Autoriza uma pessoa ou cargo a configurar o bot (só administrador).",
        options: [
          { type: 6, name: "usuario", description: "Pessoa a autorizar", required: false },
          { type: 8, name: "cargo", description: "Cargo a autorizar", required: false },
        ],
      },
      {
        type: 1,
        name: "desautorizar",
        description: "Remove a autorização de uma pessoa ou cargo (só administrador).",
        options: [
          { type: 6, name: "usuario", description: "Pessoa a remover", required: false },
          { type: 8, name: "cargo", description: "Cargo a remover", required: false },
        ],
      },
      {
        type: 1,
        name: "status",
        description: "Mostra a configuração atual e quem está autorizado.",
      },
    ],
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
