-- Fase 3 do Pool: o líder pode convidar alguém cuja classe NÃO tem vaga livre na PT.
--   preencher  : a classe do candidato tem vaga livre -> ao aceitar, ocupa essa vaga
--   agregar    : classe diferente -> ao aceitar, NASCE uma vaga nova pra ele
--   substituir : igual agregar, mas ao aceitar APAGA uma vaga livre que o líder indicou
--                (a PT mantém o mesmo tamanho)
alter table public.pool_convites
  add column if not exists tipo text not null default 'preencher'
    check (tipo in ('preencher', 'agregar', 'substituir'));

-- Só no 'substituir': a função da vaga livre a apagar quando a pessoa aceitar.
alter table public.pool_convites
  add column if not exists classe_remover text;

-- Anti-flood por PT: no máximo N envios, com intervalo mínimo entre eles. Cada "envio"
-- (em massa ou um convite avulso) conta como UMA tentativa.
create table if not exists public.pool_envios (
  pt_mensagem_id text primary key,
  guild_id text not null,
  tentativas int not null default 0,
  ultimo_envio timestamptz not null default now()
);

alter table public.pool_envios enable row level security;
