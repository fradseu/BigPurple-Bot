-- Pings salvos do /conteudo: até 2 por jogador (título + armas e quantidades).
-- Data, hora e tipo são escolhidos toda vez.
create table if not exists public.conteudo_pings (
  lider_id text not null,
  slot smallint not null check (slot in (1, 2)),
  titulo text not null default '',
  funcoes jsonb not null default '{}'::jsonb,
  atualizado_em timestamptz not null default now(),
  primary key (lider_id, slot)
);

alter table public.conteudo_pings enable row level security;
grant select, insert, update, delete on public.conteudo_pings to service_role;
