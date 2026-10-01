-- Restores the table described by generated types before its existing RLS migration.
CREATE TABLE IF NOT EXISTS public.player_progress (
  user_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  region_id integer NOT NULL REFERENCES public.regions(id),
  fase_maxima_desbloqueada integer NOT NULL DEFAULT 1,
  fase_selecionada_atual integer DEFAULT 1,
  updated_at timestamptz DEFAULT now(),
  PRIMARY KEY (user_id, region_id)
);
