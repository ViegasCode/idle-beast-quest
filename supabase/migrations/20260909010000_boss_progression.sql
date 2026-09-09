ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS current_floor integer NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS unlocked_floors integer[] NOT NULL DEFAULT '{1}',
  ADD COLUMN IF NOT EXISTS bosses_defeated integer[] NOT NULL DEFAULT '{}';

INSERT INTO public.capture_items (id, nome, tier, taxa_sucesso, chance_drop, cor)
VALUES
  (4, 'Chave do Boss', 4, 0.95, 0.04, '#f59e0b')
ON CONFLICT (id) DO UPDATE SET
  nome = EXCLUDED.nome,
  tier = EXCLUDED.tier,
  taxa_sucesso = EXCLUDED.taxa_sucesso,
  chance_drop = EXCLUDED.chance_drop,
  cor = EXCLUDED.cor;

UPDATE public.profiles
SET unlocked_floors = COALESCE(unlocked_floors, '{1}'),
    current_floor = COALESCE(current_floor, 1)
WHERE unlocked_floors IS NULL OR current_floor IS NULL;
