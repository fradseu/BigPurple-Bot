-- Candidaturas do bot de recrutamento. Cada linha = um formulário enviado,
-- com o dossiê (snapshot do que a API do Albion devolveu naquele momento)
-- guardado em JSON — assim dá pra comparar o mesmo jogador entre candidaturas
-- e ter o histórico mesmo que a API mude/pare de mostrar algo depois.
create table if not exists public.recrutamento_candidaturas (
  id uuid primary key default gen_random_uuid(),
  discord_user_id text not null,
  discord_username text not null,
  nickname text not null,
  fama_declarada text not null,
  fama_declarada_num bigint,
  como_conheceu text not null,
  albion_player_id text,
  dossie jsonb,
  status text not null default 'pendente'
    check (status in ('pendente', 'aprovada', 'recusada')),
  canal_id text,
  mensagem_id text,
  decidido_por text,
  decidido_em timestamptz,
  criado_em timestamptz not null default now()
);

create index if not exists recrutamento_candidaturas_usuario_idx
  on public.recrutamento_candidaturas (discord_user_id, criado_em desc);
create index if not exists recrutamento_candidaturas_albion_idx
  on public.recrutamento_candidaturas (albion_player_id);

-- No máximo UMA candidatura pendente por pessoa. Garantido no banco (não só no
-- código): se a pessoa clicar "Enviar" duas vezes rápido, a segunda é recusada
-- pelo próprio Postgres, mesmo que as duas tenham passado pela checagem do código.
create unique index if not exists recrutamento_uma_pendente_por_usuario
  on public.recrutamento_candidaturas (discord_user_id)
  where status = 'pendente';

-- Mesmo esquema do pt_wizard_state: RLS ligado e SEM policies = anon/authenticated
-- não leem nem escrevem. Só a Edge Function (service role) acessa.
alter table public.recrutamento_candidaturas enable row level security;
