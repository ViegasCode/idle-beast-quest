ALTER TABLE public.regions ADD COLUMN IF NOT EXISTS fases integer NOT NULL DEFAULT 8;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_captura boolean NOT NULL DEFAULT false;

ALTER TABLE public.creatures ADD COLUMN IF NOT EXISTS exp integer NOT NULL DEFAULT 0;

ALTER TABLE public.hunting_sessions
  ADD COLUMN IF NOT EXISTS fase integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fase_kills integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS kills_total integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS exp_total bigint NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS ultima_resolucao_em timestamp with time zone NOT NULL DEFAULT now(),
  ADD COLUMN IF NOT EXISTS pressao numeric NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pending_species_id integer REFERENCES public.species(id),
  ADD COLUMN IF NOT EXISTS pending_nivel integer,
  ADD COLUMN IF NOT EXISTS pending_expira_em timestamp with time zone;

CREATE TABLE IF NOT EXISTS public.capture_items (
  id integer PRIMARY KEY,
  nome text NOT NULL,
  tier integer NOT NULL,
  taxa_sucesso numeric NOT NULL,
  chance_drop numeric NOT NULL,
  cor text NOT NULL DEFAULT '#94a3b8',
  created_at timestamp with time zone NOT NULL DEFAULT now()
);
GRANT SELECT ON public.capture_items TO anon;
GRANT SELECT ON public.capture_items TO authenticated;
GRANT ALL ON public.capture_items TO service_role;
ALTER TABLE public.capture_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "capture_items public read" ON public.capture_items;
CREATE POLICY "capture_items public read" ON public.capture_items FOR SELECT USING (true);

CREATE TABLE IF NOT EXISTS public.user_items (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  item_id integer NOT NULL REFERENCES public.capture_items(id),
  quantidade integer NOT NULL DEFAULT 0,
  created_at timestamp with time zone NOT NULL DEFAULT now(),
  updated_at timestamp with time zone NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, item_id)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_items TO authenticated;
GRANT ALL ON public.user_items TO service_role;
ALTER TABLE public.user_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "own items" ON public.user_items;
CREATE POLICY "own items" ON public.user_items FOR ALL TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$ BEGIN NEW.updated_at = now(); RETURN NEW; END; $$
LANGUAGE plpgsql SET search_path = public;

DROP TRIGGER IF EXISTS update_user_items_updated_at ON public.user_items;
CREATE TRIGGER update_user_items_updated_at BEFORE UPDATE ON public.user_items
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.capture_items (id, nome, tier, taxa_sucesso, chance_drop, cor) VALUES
  (1, 'Bola Comum', 1, 0.45, 0.15, '#94a3b8'),
  (2, 'Bola Rara', 2, 0.70, 0.09, '#38bdf8'),
  (3, 'Bola Suprema', 3, 0.92, 0.04, '#fbbf24')
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome, tier = EXCLUDED.tier,
  taxa_sucesso = EXCLUDED.taxa_sucesso, chance_drop = EXCLUDED.chance_drop, cor = EXCLUDED.cor;

UPDATE public.hunting_sessions SET ultima_resolucao_em = ultima_coleta_em WHERE ultima_resolucao_em < ultima_coleta_em;