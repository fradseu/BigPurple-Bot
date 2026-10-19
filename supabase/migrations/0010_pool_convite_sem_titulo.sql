-- O título da PT não vai mais no convite (pode identificar o líder/grupo): o código deixou
-- de enviá-lo e de guardá-lo, então a coluna sai. Só guardava o título de convites que já
-- expiram em 3 minutos.
alter table public.pool_convites drop column if exists pt_titulo;
