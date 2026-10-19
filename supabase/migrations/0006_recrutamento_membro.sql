-- Aprovação aplica o cargo de Membro e o apelido do jogo.
--
-- cargo_membro_id: cargo dado a quem é aprovado (configurado por servidor com
-- /recrutamento-config membro).
-- apelido_aplicado: o apelido que o bot definiu na aprovação. Fica gravado junto
-- de albion_player_id pra um bot futuro conferir "ainda está na guilda?" e
-- "o apelido continua o mesmo?" sem depender de ninguém lembrar.
alter table public.recrutamento_config
  add column if not exists cargo_membro_id text;

alter table public.recrutamento_candidaturas
  add column if not exists apelido_aplicado text;
