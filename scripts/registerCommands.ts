// registerCommands.ts - Script ÚNICO (roda local, fora da Edge Function) pra
// registrar os slash commands (/conteudo, /termos, /killboard, /diagnostico) no Discord.
// Só precisa rodar de novo se a LISTA de comandos mudar (nome, descrição).
//
// Como rodar (a partir da raiz do projeto, "BigPurple-Bot"):
//   deno run --allow-net --allow-env --env-file=.env scripts/registerCommands.ts
//
// Precisa de um arquivo .env (NÃO commitado — já está no .gitignore) com:
//   DISCORD_TOKEN=...
//   DISCORD_APPLICATION_ID=<id do novo app>

const token = Deno.env.get("DISCORD_TOKEN");
const applicationId = Deno.env.get("DISCORD_APPLICATION_ID");

if (!token || !applicationId) {
  console.error(
    "Faltam DISCORD_TOKEN e/ou DISCORD_APPLICATION_ID. Crie um .env na raiz do projeto (veja o topo deste arquivo).",
  );
  Deno.exit(1);
}

const comandos = [
  {
    name: "conteudo",
    description: "Inicia a criação guiada de uma nova PT do clã.",
    type: 1,
  },
  {
    name: "termos",
    description: "Exibe os Termos de Serviço e a Política de Privacidade do Bot.",
    type: 1,
  },
  {
    name: "killboard",
    description: "Killboard da guilda: ranking dos Membros e configuração do canal.",
    type: 1,
    // Sem default_member_permissions: o "ranking" é pra todos. ativar/desativar/status conferem
    // no código se quem chamou pode Gerenciar servidor.
    dm_permission: false,
    options: [
      {
        name: "ativar",
        description: "Ativa (ou muda) o canal do killboard.",
        type: 1,
        options: [
          {
            name: "canal",
            description: "Canal onde os eventos serão postados.",
            type: 7, // CHANNEL
            channel_types: [0, 5], // texto e anúncios
            required: true,
          },
          {
            name: "cargo",
            description: "Cargo exigido (padrão: o cargo de Membro do recrutamento).",
            type: 8, // ROLE
            required: false,
          },
        ],
      },
      { name: "desativar", description: "Para de postar no killboard.", type: 1 },
      { name: "status", description: "Mostra a configuração atual do killboard.", type: 1 },
      { name: "ranking", description: "Top 10 de kills, assistências e mortes dos últimos 30 dias.", type: 1 },
    ],
  },
  // /diagnostico desativado por enquanto (deixa comentado, não apagado —
  // é só descomentar aqui + em index.ts pra voltar a usar).
  // {
  //   name: "diagnostico",
  //   description: "Testa se os emojis do config.ts estão renderizando.",
  //   type: 1,
  // },
];

const res = await fetch(`https://discord.com/api/v10/applications/${applicationId}/commands`, {
  method: "PUT",
  headers: {
    Authorization: `Bot ${token}`,
    "Content-Type": "application/json",
  },
  body: JSON.stringify(comandos),
});

if (!res.ok) {
  console.error(`Falhou (${res.status}):`, await res.text());
  Deno.exit(1);
}

const registrados = await res.json();
console.log(`✅ ${registrados.length} comando(s) registrado(s):`, registrados.map((c: { name: string }) => `/${c.name}`).join(", "));
