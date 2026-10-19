-- O retrato diário passa a levar tudo que o dossiê do recrutamento já levava: fama total,
-- aliança, atividade de PvP no killboard (última, contagem e do dia), guildas pelas quais o
-- jogador foi visto e as últimas kills/mortes.
--
-- Todas as colunas novas aceitam null de propósito: o killboard é uma segunda chamada, e quando
-- ela falha o retrato continua valendo — `killboard_ok = false` diz que aqueles campos não vieram
-- (diferente de "veio e é zero").

alter table public.guilda_snapshots
  add column if not exists fama_total bigint,
  add column if not exists alianca text,
  add column if not exists killboard_ok boolean not null default false,
  add column if not exists ultima_atividade_pvp timestamptz,
  add column if not exists kills_recentes int,
  add column if not exists mortes_recentes int,
  add column if not exists eventos_pvp_no_dia int,
  add column if not exists ultimas_kills jsonb,
  add column if not exists ultimas_mortes jsonb,
  add column if not exists guildas_vistas jsonb;
