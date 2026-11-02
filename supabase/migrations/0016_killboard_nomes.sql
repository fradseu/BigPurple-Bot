-- Ranking e killboard mostram o NOME DO JOGO (não menção @, que vira "usuário-desconhecido" para
-- quem não está no cache do aparelho). Guardamos os nomes junto de cada evento postado, na mesma
-- ordem de discord_ids.
alter table public.killboard_postados
  add column if not exists nomes text[] not null default '{}';
