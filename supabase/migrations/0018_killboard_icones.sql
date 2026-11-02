-- Cache dos ícones de itens (PNG em base64) usados no card "Detalhes do abate". O servidor de
-- imagens do Albion às vezes cai; com o cache, cada ícone só precisa ser baixado uma vez.
create table if not exists public.killboard_icones (
  tipo text primary key,
  png_base64 text not null,
  guardado_em timestamptz not null default now()
);

alter table public.killboard_icones enable row level security;
grant select, insert, update, delete on public.killboard_icones to service_role;
