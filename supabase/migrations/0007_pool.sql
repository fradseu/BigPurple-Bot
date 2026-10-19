-- Pool de conteúdo (terceiro bot): jogadores se oferecem de forma ANÔNIMA pra
-- atividades (DG etc.) e líderes montam grupo a partir do catálogo.
-- Fase 1: disponibilidade + caixa privada de cada pessoa.

-- Canal do pool por servidor (definido ao usar /pool-painel).
create table if not exists public.pool_config (
  guild_id text primary key,
  canal_pool_id text,
  atualizado_em timestamptz not null default now()
);

-- A "caixa de entrada" de cada pessoa: UM tópico privado fixo, só dela + do bot.
-- O pseudônimo é o que o líder enxerga no catálogo (ninguém vê o nick).
create table if not exists public.pool_caixas (
  guild_id text not null,
  user_id text not null,
  thread_id text not null,
  controle_mensagem_id text,
  pseudonimo text not null,
  criado_em timestamptz not null default now(),
  primary key (guild_id, user_id),
  unique (guild_id, pseudonimo)
);

-- Cada oferta. Só uma ATIVA por pessoa em cada servidor.
create table if not exists public.pool_disponibilidades (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  user_id text not null,
  pseudonimo text not null,
  atividades text[] not null,
  classes text[] not null,
  tier text not null,
  expira_em timestamptz not null,
  status text not null default 'ativa'
    check (status in ('ativa', 'cancelada', 'expirada', 'aceita')),
  criado_em timestamptz not null default now()
);

create unique index if not exists pool_uma_ativa_por_pessoa
  on public.pool_disponibilidades (guild_id, user_id)
  where status = 'ativa';

create index if not exists pool_disponibilidades_expiracao_idx
  on public.pool_disponibilidades (expira_em)
  where status = 'ativa';

-- Estado do formulário "Ficar disponível" (várias listas na mesma mensagem:
-- cada clique só traz a lista alterada, então o resto precisa ser lembrado).
create table if not exists public.pool_wizard (
  guild_id text not null,
  user_id text not null,
  dados jsonb not null,
  atualizado_em timestamptz not null default now(),
  primary key (guild_id, user_id)
);

-- RLS ligado e SEM policies: só a Edge Function (service role) acessa.
alter table public.pool_config enable row level security;
alter table public.pool_caixas enable row level security;
alter table public.pool_disponibilidades enable row level security;
alter table public.pool_wizard enable row level security;
