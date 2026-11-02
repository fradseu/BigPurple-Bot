-- Evento completo de cada kill postada (equipamento de matador e vítima). A imagem "Detalhes do
-- abate" (function killboard-imagem) é desenhada a partir daqui, sem depender da API do Albion.
create table if not exists public.killboard_eventos (
  event_id bigint primary key,
  evento jsonb not null,
  guardado_em timestamptz not null default now()
);

alter table public.killboard_eventos enable row level security;
grant select, insert, update, delete on public.killboard_eventos to service_role;

-- Mesmo prazo do registro de postados.
select cron.schedule(
  'limpar-killboard-eventos',
  '35 4 * * *',
  $$ delete from public.killboard_eventos where guardado_em < now() - interval '30 days'; $$
);
