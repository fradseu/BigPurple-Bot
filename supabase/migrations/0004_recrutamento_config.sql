-- Configuração do recrutamento POR SERVIDOR (substitui os IDs que ficavam fixos
-- no código). Quem pode mexer: administradores do servidor + os autorizados
-- guardados aqui (usuários e/ou cargos). Só administrador consegue alterar a
-- lista de autorizados — isso é verificado na Edge Function.
create table if not exists public.recrutamento_config (
  guild_id text primary key,
  canal_recrutadores_id text,
  cargo_recrutador_id text,
  autorizados_usuarios text[] not null default '{}',
  autorizados_cargos text[] not null default '{}',
  atualizado_por text,
  atualizado_em timestamptz not null default now()
);

-- Mesmo esquema das outras tabelas: RLS ligado e SEM policies = anon/authenticated
-- não leem nem escrevem. Só a Edge Function (service role) acessa.
alter table public.recrutamento_config enable row level security;

-- Cada candidatura passa a saber de qual servidor veio (o bot pode estar em
-- mais de um). Nulo nas candidaturas criadas antes desta migration.
alter table public.recrutamento_candidaturas
  add column if not exists guild_id text;
