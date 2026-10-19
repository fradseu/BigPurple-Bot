-- Fase 2 do Pool: o líder convida alguém do catálogo e o convite aparece SÓ na
-- caixa privada da pessoa (some em 3 minutos). Aceitar entra na vaga da PT.

-- Qual ÁREA (PVE/PVP/FAC/AVALON) cada canal de ping representa, por servidor:
-- { "<id do canal de ping>": "PVE", ... }. A PT mora num tópico desse canal, então
-- é por aqui que o catálogo descobre a área da PT.
alter table public.pool_config
  add column if not exists areas_canais jsonb not null default '{}'::jsonb;

create table if not exists public.pool_convites (
  id uuid primary key default gen_random_uuid(),
  guild_id text not null,
  disponibilidade_id uuid not null references public.pool_disponibilidades (id) on delete cascade,
  candidato_user_id text not null,
  lider_user_id text not null,
  pt_canal_id text not null,       -- tópico da PT (onde mora o painel)
  pt_mensagem_id text not null,    -- mensagem do painel da PT
  pt_titulo text not null,
  classe text not null,            -- vaga pra qual convidou
  thread_id text,                  -- caixa da pessoa (onde o convite foi postado)
  mensagem_id text,                -- mensagem do convite na caixa
  status text not null default 'pendente'
    check (status in ('pendente', 'aceito', 'recusado', 'expirado', 'cancelado')),
  expira_em timestamptz not null,
  criado_em timestamptz not null default now()
);

-- Um líder não convida a mesma pessoa duas vezes pra mesma PT enquanto o primeiro
-- convite ainda está pendente (garantido no banco, não só no código).
create unique index if not exists pool_convite_unico_pendente
  on public.pool_convites (disponibilidade_id, pt_mensagem_id)
  where status = 'pendente';

create index if not exists pool_convites_expiracao_idx
  on public.pool_convites (expira_em)
  where status = 'pendente';

create index if not exists pool_convites_pt_idx
  on public.pool_convites (pt_mensagem_id)
  where status = 'pendente';

alter table public.pool_convites enable row level security;
