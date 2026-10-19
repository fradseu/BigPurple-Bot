-- A pessoa escolhe em quais ÁREAS quer jogar (PVE, PVP, FAC, AVALON — os canais de
-- ping onde as PTs são criadas). Linhas antigas ficam com lista vazia.
alter table public.pool_disponibilidades
  add column if not exists areas text[] not null default '{}';
