-- O card "Detalhes do abate" leva alguns segundos para ser desenhado (ícones). Guardamos o PNG
-- pronto: o killboard gera antes de postar e o Discord recebe na hora.
alter table public.killboard_eventos
  add column if not exists png_base64 text;
