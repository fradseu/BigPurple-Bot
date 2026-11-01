-- Vínculo Discord <-> jogador do Albion, num lugar só (usado pelo killboard e por futuras ferramentas).
--
-- Origem do vínculo:
--   'recrutamento' — candidatura aprovada no bot de recrutamento;
--   'similaridade' — membro antigo (entrou antes do recrutamento) casado pelo nome do Discord;
--   'manual'       — definido à mão.
--
-- Ajuste do aprovador: se a aprovação acontecer com a API do Albion fora (candidatura sem
-- albion_player_id), o banco completa o id pelo nome usando o retrato da guilda (guilda_membros).
-- Se a pessoa ainda não estiver no retrato, o id é completado quando ela aparecer nele.
create table if not exists public.membros_vinculo (
  guild_id text not null,
  albion_player_id text not null,
  discord_user_id text not null,
  nome_albion text not null,
  origem text not null check (origem in ('recrutamento', 'similaridade', 'manual')),
  criado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now(),
  primary key (guild_id, albion_player_id)
);

create index if not exists membros_vinculo_discord_idx on public.membros_vinculo (guild_id, discord_user_id);

alter table public.membros_vinculo enable row level security;
grant select, insert, update, delete on public.membros_vinculo to service_role;

-- 1) Candidatura aprovada sem id do Albion: completa pelo nome (apelido aplicado ou nick digitado).
create or replace function public.recrutamento_completar_albion_id()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'aprovada' and new.albion_player_id is null then
    select gm.player_id into new.albion_player_id
      from public.guilda_membros gm
     where gm.ativo
       and lower(gm.nome) in (lower(coalesce(new.apelido_aplicado, '')), lower(new.nickname))
     limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists recrutamento_completar_albion_id on public.recrutamento_candidaturas;
create trigger recrutamento_completar_albion_id
  before insert or update on public.recrutamento_candidaturas
  for each row execute function public.recrutamento_completar_albion_id();

-- 2) Candidatura aprovada com id do Albion: grava/atualiza o vínculo (origem recrutamento).
create or replace function public.recrutamento_gravar_vinculo()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.status = 'aprovada' and new.albion_player_id is not null and new.guild_id is not null then
    insert into public.membros_vinculo (guild_id, albion_player_id, discord_user_id, nome_albion, origem)
    values (new.guild_id, new.albion_player_id, new.discord_user_id,
            coalesce(new.apelido_aplicado, new.nickname), 'recrutamento')
    on conflict (guild_id, albion_player_id) do update
      set discord_user_id = excluded.discord_user_id,
          nome_albion = excluded.nome_albion,
          origem = 'recrutamento',
          atualizado_em = now();
  end if;
  return new;
end;
$$;

drop trigger if exists recrutamento_gravar_vinculo on public.recrutamento_candidaturas;
create trigger recrutamento_gravar_vinculo
  after insert or update on public.recrutamento_candidaturas
  for each row execute function public.recrutamento_gravar_vinculo();

-- 3) Jogador apareceu no retrato da guilda: completa candidaturas aprovadas que estavam sem id.
create or replace function public.guilda_membro_completar_candidaturas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.ativo then
    update public.recrutamento_candidaturas c
       set albion_player_id = new.player_id
     where c.status = 'aprovada'
       and c.albion_player_id is null
       and lower(new.nome) in (lower(coalesce(c.apelido_aplicado, '')), lower(c.nickname));
  end if;
  return new;
end;
$$;

drop trigger if exists guilda_membro_completar_candidaturas on public.guilda_membros;
create trigger guilda_membro_completar_candidaturas
  after insert or update on public.guilda_membros
  for each row execute function public.guilda_membro_completar_candidaturas();

-- Ninguém de fora chama essas funções direto.
revoke all on function public.recrutamento_completar_albion_id() from public, anon, authenticated;
revoke all on function public.recrutamento_gravar_vinculo() from public, anon, authenticated;
revoke all on function public.guilda_membro_completar_candidaturas() from public, anon, authenticated;

-- Retroativo: aprovadas que ficaram sem id (o update dispara os gatilhos acima).
update public.recrutamento_candidaturas set status = status
 where status = 'aprovada';
