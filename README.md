# Big Purple - Conteúdo v1.2

Bot de Discord pra organizar PTs de conteúdo do clã (Albion Online) — reescrita
do bot original (v1, Replit + discord.js Gateway) usando **Supabase Edge
Functions** (Deno + TypeScript) e o modelo **HTTP Interactions Endpoint** do
Discord, em vez de manter uma conexão permanente (Gateway).

O v1 continua rodando normalmente no Replit. Este projeto é uma versão nova,
em paralelo, testada numa aplicação Discord separada até estar validada.

## Por que essa arquitetura

- **v1 (Gateway)**: processo Node.js precisa ficar ligado 24/7. No plano
  grátis do Replit, ele dorme sem uso — primeira interação depois de um tempo
  parado costuma falhar ("cold start" do próprio Replit, não do Discord).
- **v1.2 (HTTP Interactions Endpoint)**: o Discord manda cada clique/comando
  como uma requisição HTTP avulsa pra uma URL. Isso é exatamente o que
  serverless (Supabase Edge Functions) foi feito pra atender — sem processo
  residente, sem sono, sem cold start de minutos.

Trade-off: sem processo vivo, não dá pra guardar estado em memória entre um
clique e o próximo (o wizard de criação de PT tem 3 passos). Por isso o
estado vai pro Postgres do Supabase (tabela `pt_wizard_state`) em vez de um
`Map` em JavaScript.

## Estrutura

```
supabase/functions/discord-bot/
  index.ts        — entrypoint HTTP: verifica assinatura, roteia a interação
  discord/        — chamadas REST cruas ao Discord + tipos + builders de resposta
  db/              — cliente Supabase + estado do wizard (Passo 1→2→3)
  domain/           — lógica pura (cálculo de dificuldade, emoji, vagas) — testável isolada
  handlers/          — um arquivo por grupo de interações
  config.ts           — funções, atividades, cidades, zonas, dificuldade, bônus, emojis
scripts/
  registerCommands.ts — script único pra registrar os slash commands
supabase/migrations/
  0001_pt_wizard_state.sql
.github/workflows/
  deploy.yml           — publica a Edge Function a cada push na main
```

## Setup local

```bash
npm install                 # instala o CLI do Supabase como dependência do projeto
npx supabase --version      # confirma que o CLI funciona
```

O projeto já está linkado ao projeto Supabase (`qroosefyfxefjrlhogrh`). Pra
rodar comandos do CLI, sempre via `npx supabase ...` a partir da raiz do
repositório.

### Registrar os slash commands (só precisa rodar 1x, ou quando a lista mudar)

```bash
cp .env.example .env        # preenche DISCORD_TOKEN e DISCORD_APPLICATION_ID
deno run --allow-net --allow-env --env-file=.env scripts/registerCommands.ts
```

### Configurar os secrets da function

```bash
npx supabase secrets set DISCORD_TOKEN=xxxxx
npx supabase secrets set DISCORD_PUBLIC_KEY=xxxxx
```

(`SUPABASE_URL` e `SUPABASE_SERVICE_ROLE_KEY` são injetados automaticamente
pelo Supabase — não precisa configurar esses dois.)

### Deploy manual (sem esperar o GitHub Action)

```bash
npx supabase functions deploy discord-bot
```

### Cadastrar o Interactions Endpoint

No [Developer Portal](https://discord.com/developers/applications), na
aplicação do bot, campo **"Interactions Endpoint URL"**, cola a URL da
function publicada (formato
`https://<project-ref>.supabase.co/functions/v1/discord-bot`). O Discord
testa o handshake (PING → PONG) nesse momento — só salva se responder certo.

## Deploy automático (GitHub)

- Migrations (`supabase/migrations/*.sql`): aplicadas automaticamente pela
  integração GitHub↔Supabase configurada no painel do Supabase, a cada merge
  na `main`.
- Edge Function: publicada pelo workflow `.github/workflows/deploy.yml` a
  cada push na `main` (precisa dos secrets `SUPABASE_ACCESS_TOKEN` e
  `SUPABASE_PROJECT_ID` cadastrados no repositório do GitHub).

## Bot de Recrutamento (`recrutamento-bot`)

Segunda Edge Function, **outro app do Discord** (outro token/chave), mesmo
projeto Supabase. Fluxo: o candidato clica em "Solicitar ingresso" → preenche
nickname, fama total e como conheceu a guilda → o bot consulta a API pública do
Albion (servidor Americas), monta um **dossiê** e posta no canal dos
recrutadores, que clicam **Aprovar / Recusar**.

O dossiê traz: guilda/aliança atual, fama total e por tipo (PvE, coleta, craft,
pesca, fazenda, PvP), comparação com a fama declarada, últimas kills e mortes,
guildas pelas quais foi visto e alertas. A API oficial **não tem histórico de
guildas** — ele é reconstruído dos eventos do killboard (só enxerga períodos
com PvP).

```
supabase/functions/recrutamento-bot/
  index.ts           — entrypoint (assinatura, roteamento, erros de background)
  config.ts          — IDs do canal/cargo dos recrutadores, limites dos alertas
  albion/            — cliente da API do Albion + montagem do dossiê (testado)
  domain/            — parser de fama ("1,33b") e histórico de guildas (testado)
  db/                — tabela recrutamento_candidaturas
  handlers/          — painel, formulário, Aprovar/Recusar/Atualizar
supabase/migrations/0003_recrutamento.sql
scripts/registerRecrutamentoCommands.ts
```

Secrets (`npx supabase secrets set`): `RECRUTAMENTO_DISCORD_TOKEN` e
`RECRUTAMENTO_PUBLIC_KEY`. Testes: `deno test` dentro da pasta da function.

## Plano completo

O plano de arquitetura e decisões tomadas está registrado em
`C:\Users\23000631\.claude\plans\quirky-hatching-lampson.md` (fora deste
repositório, é o plano da sessão que criou este projeto).
