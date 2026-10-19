-- Acompanhamento diário da guilda no Albion: um "retrato" por membro por dia, tirado da
-- API oficial (gameinfo). Com dois retratos de dias diferentes dá pra ver o progresso.
-- Tudo só pela nuvem: quem escreve é a Edge Function guilda-snapshot (service role).

-- Guildas acompanhadas. `conselheiros_nomes` são os nomes em jogo dos conselheiros
-- (o fundador vem da própria API). Todo o resto é "player".
create table if not exists public.guilda_albion (
  albion_guild_id text primary key,
  nome text not null,
  servidor text not null default 'americas',
  fundada_em timestamptz not null,
  conselheiros_nomes text[] not null default '{}',
  atualizado_em timestamptz not null default now()
);

-- Quem é/foi da guilda. A API não informa a data de entrada:
--   'dia_seguinte_a_fundacao' = já estava na primeira vez que olhamos (entrou no dia seguinte
--                               à fundação, data exata indisponível);
--   'primeiro_dia_visto'      = apareceu depois; a entrada é o dia em que o vimos pela 1ª vez.
create table if not exists public.guilda_membros (
  albion_guild_id text not null references public.guilda_albion (albion_guild_id),
  player_id text not null,
  nome text not null,
  papel text not null default 'player' check (papel in ('fundador', 'conselheiro', 'player')),
  entrada_data date not null,
  entrada_origem text not null check (entrada_origem in ('dia_seguinte_a_fundacao', 'primeiro_dia_visto')),
  ativo boolean not null default true,
  saiu_em date,
  primary key (albion_guild_id, player_id)
);

-- O retrato do dia de cada membro. As estatísticas do Albion são acumuladas da vida inteira
-- do jogador; o progresso do dia é a diferença entre dois retratos.
create table if not exists public.guilda_snapshots (
  albion_guild_id text not null,
  player_id text not null,
  dia date not null,
  nome text not null,
  kill_fame bigint,
  death_fame bigint,
  fame_ratio numeric,
  pve_total bigint,
  pve_royal bigint,
  pve_outlands bigint,
  pve_avalon bigint,
  pve_hellgate bigint,
  pve_corrupted bigint,
  pve_mists bigint,
  coleta_total bigint,
  coleta_royal bigint,
  coleta_outlands bigint,
  coleta_avalon bigint,
  coleta_fibra bigint,
  coleta_couro bigint,
  coleta_minerio bigint,
  coleta_pedra bigint,
  coleta_madeira bigint,
  craft_total bigint,
  craft_royal bigint,
  craft_outlands bigint,
  craft_avalon bigint,
  pesca bigint,
  fazenda bigint,
  crystal bigint,
  estatisticas_em timestamptz, -- quando o Albion atualizou essas estatísticas (não é em tempo real)
  bruto jsonb not null, -- resposta completa, pra não perder campo que a gente não mapeou
  criado_em timestamptz not null default now(),
  primary key (albion_guild_id, player_id, dia)
);

create index if not exists guilda_snapshots_por_dia on public.guilda_snapshots (albion_guild_id, dia);

-- O retrato da guilda em si.
create table if not exists public.guilda_snapshots_guilda (
  albion_guild_id text not null,
  dia date not null,
  membros int,
  kill_fame bigint,
  death_fame bigint,
  ataques_vencidos int,
  defesas_vencidas int,
  criado_em timestamptz not null default now(),
  primary key (albion_guild_id, dia)
);

alter table public.guilda_albion enable row level security;
alter table public.guilda_membros enable row level security;
alter table public.guilda_snapshots enable row level security;
alter table public.guilda_snapshots_guilda enable row level security;
