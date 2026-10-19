-- Corrige a regra "uma candidatura pendente por pessoa": antes valia no mundo
-- todo (discord_user_id), então quem tinha uma pendente num servidor ficava
-- bloqueado de se candidatar em outro. Agora vale POR SERVIDOR.

-- A candidatura de teste criada antes da coluna guild_id existir: preenche com
-- o servidor de teste (o canal dos recrutadores dela é o #geral dele).
update public.recrutamento_candidaturas
   set guild_id = '1561757296651141241'
 where guild_id is null
   and canal_id = '1561757297385021452';

drop index if exists public.recrutamento_uma_pendente_por_usuario;

-- No máximo UMA pendente por (servidor, pessoa). Linhas antigas com guild_id
-- nulo não entram na conta (NULL é distinto de NULL em índice único).
create unique index if not exists recrutamento_uma_pendente_por_servidor_usuario
  on public.recrutamento_candidaturas (guild_id, discord_user_id)
  where status = 'pendente';
