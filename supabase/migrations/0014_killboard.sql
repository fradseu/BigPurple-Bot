-- Killboard da guilda: posta num canal do Discord as kills, mortes e assistências dos membros
-- da guilda no Albion que tenham o cargo "Membro" no Discord.
--
-- Quem é quem: o vínculo Discord <-> jogador do Albion vem das candidaturas APROVADAS do bot de
-- recrutamento (recrutamento_candidaturas.albion_player_id). Quem não passou pelo recrutamento
-- não aparece no killboard.
--
-- Quem escreve: a Edge Function discord-bot (service role), chamada por um job do pg_cron a cada
-- 5 min. O segredo das rotas internas é gerado AQUI, no próprio banco (bot_segredos), e lido em
-- tempo de execução pelo job e pela function — nunca vai pro Git nem precisa ser digitado.

-- Configuração por servidor do Discord (definida com /killboard ativar).
create table if not exists public.killboard_config (
  guild_id text primary key,
  canal_id text not null,
  -- Cargo exigido. Nulo = usa o cargo de Membro do recrutamento (recrutamento_config.cargo_membro_id).
  cargo_membro_id text,
  -- Guilda do Albion. Nulo = a primeira guilda acompanhada em guilda_albion.
  albion_guild_id text,
  ativo boolean not null default true,
  -- Só eventos depois disso são postados (evita despejar o histórico ao ativar).
  ativado_em timestamptz not null default now(),
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);

-- Eventos já postados (um evento nunca sai duas vezes no mesmo servidor).
create table if not exists public.killboard_postados (
  guild_id text not null,
  event_id bigint not null,
  tipo text not null check (tipo in ('kill', 'morte', 'assistencia')),
  mensagem_id text,
  -- Para o ranking dos últimos 30 dias (/killboard ranking).
  fama bigint not null default 0,
  -- Membros envolvidos (Discord), na ordem da classificação: numa kill, o 1º é o matador e os
  -- demais ajudaram (contam como assistência).
  discord_ids text[] not null default '{}',
  postado_em timestamptz not null default now(),
  primary key (guild_id, event_id)
);

create index if not exists killboard_postados_data_idx
  on public.killboard_postados (guild_id, postado_em);

-- Mesmo esquema das outras tabelas: RLS ligado e SEM policies = anon/authenticated não leem nem
-- escrevem. Só a Edge Function (service role) acessa.
alter table public.killboard_config enable row level security;
alter table public.killboard_postados enable row level security;

grant select, insert, update, delete on public.killboard_config to service_role;
grant select, insert, update, delete on public.killboard_postados to service_role;

-- Segredos internos (só service role). 'interno' protege as rotas /internal/* do discord-bot.
create table if not exists public.bot_segredos (
  nome text primary key,
  valor text not null,
  criado_em timestamptz not null default now()
);
alter table public.bot_segredos enable row level security;
grant select on public.bot_segredos to service_role;

insert into public.bot_segredos (nome, valor)
values ('interno', encode(extensions.gen_random_bytes(32), 'hex'))
on conflict (nome) do nothing;

-- Rodada do killboard a cada 5 minutos.
select cron.schedule(
  'killboard',
  '*/5 * * * *',
  $$
    select net.http_post(
      url := 'https://qroosefyfxefjrlhogrh.supabase.co/functions/v1/discord-bot/internal/killboard',
      headers := jsonb_build_object(
        'x-cron-secret', (select valor from public.bot_segredos where nome = 'interno')
      )
    );
  $$
);

-- Limpeza: o registro de postados só precisa cobrir o que a API do Albion ainda devolve.
select cron.schedule(
  'limpar-killboard-postados',
  '30 4 * * *', -- todo dia, 01:30 de Brasília
  $$
    delete from public.killboard_postados where postado_em < now() - interval '30 days';
  $$
);
