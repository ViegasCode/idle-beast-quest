CREATE TABLE public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users ON DELETE CASCADE,
  nome_treinador TEXT NOT NULL,
  starter_escolhido BOOLEAN NOT NULL DEFAULT false,
  criado_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.profiles TO authenticated;
GRANT ALL ON public.profiles TO service_role;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own profile" ON public.profiles FOR ALL TO authenticated USING (auth.uid() = id) WITH CHECK (auth.uid() = id);

CREATE TABLE public.species (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  tipo_primario TEXT NOT NULL,
  tipo_secundario TEXT,
  hp_base INT NOT NULL,
  ataque_base INT NOT NULL,
  defesa_base INT NOT NULL,
  velocidade_base INT NOT NULL,
  taxa_raridade_base NUMERIC NOT NULL DEFAULT 1,
  sprite_url TEXT,
  is_starter BOOLEAN NOT NULL DEFAULT false
);
GRANT SELECT ON public.species TO authenticated, anon;
GRANT ALL ON public.species TO service_role;
ALTER TABLE public.species ENABLE ROW LEVEL SECURITY;
CREATE POLICY "species public read" ON public.species FOR SELECT TO authenticated, anon USING (true);

CREATE TABLE public.regions (
  id SERIAL PRIMARY KEY,
  nome TEXT NOT NULL,
  descricao TEXT,
  nivel_minimo INT NOT NULL,
  nivel_maximo INT NOT NULL,
  species_ids INT[] NOT NULL DEFAULT '{}',
  multiplicador_raridade NUMERIC NOT NULL DEFAULT 1
);
GRANT SELECT ON public.regions TO authenticated, anon;
GRANT ALL ON public.regions TO service_role;
ALTER TABLE public.regions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "regions public read" ON public.regions FOR SELECT TO authenticated, anon USING (true);

CREATE TABLE public.creatures (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  species_id INT NOT NULL REFERENCES public.species(id),
  user_id UUID NOT NULL REFERENCES auth.users ON DELETE CASCADE,
  nivel INT NOT NULL DEFAULT 1,
  iv_hp INT NOT NULL DEFAULT 0,
  iv_ataque INT NOT NULL DEFAULT 0,
  iv_defesa INT NOT NULL DEFAULT 0,
  iv_velocidade INT NOT NULL DEFAULT 0,
  nature TEXT NOT NULL DEFAULT 'Neutra',
  raridade TEXT NOT NULL DEFAULT 'Comum',
  is_shiny BOOLEAN NOT NULL DEFAULT false,
  capturada_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX creatures_user_idx ON public.creatures(user_id);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.creatures TO authenticated;
GRANT ALL ON public.creatures TO service_role;
ALTER TABLE public.creatures ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own creatures" ON public.creatures FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE TABLE public.hunting_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL UNIQUE REFERENCES auth.users ON DELETE CASCADE,
  creature_id UUID NOT NULL REFERENCES public.creatures(id) ON DELETE CASCADE,
  region_id INT NOT NULL REFERENCES public.regions(id),
  iniciado_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  ultima_coleta_em TIMESTAMPTZ NOT NULL DEFAULT now()
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.hunting_sessions TO authenticated;
GRANT ALL ON public.hunting_sessions TO service_role;
ALTER TABLE public.hunting_sessions ENABLE ROW LEVEL SECURITY;
CREATE POLICY "own session" ON public.hunting_sessions FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

INSERT INTO public.species (nome, tipo_primario, tipo_secundario, hp_base, ataque_base, defesa_base, velocidade_base, taxa_raridade_base, sprite_url, is_starter) VALUES
('Flambit','Fogo',NULL,45,55,40,50,10,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Flambit',true),
('Aqualing','Água',NULL,50,45,50,45,10,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Aqualing',true),
('Verdemink','Planta',NULL,52,48,52,40,10,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Verdemink',true),
('Sparkitt','Elétrico',NULL,42,52,38,65,8,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Sparkitt',false),
('Pebblor','Pedra',NULL,60,50,70,25,8,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Pebblor',false),
('Zephyra','Voador',NULL,44,50,42,70,7,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Zephyra',false),
('Mossbeak','Planta','Voador',48,52,46,58,6,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Mossbeak',false),
('Frostmew','Gelo',NULL,50,54,48,52,6,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Frostmew',false),
('Cindertail','Fogo','Pedra',55,62,58,38,5,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Cindertail',false),
('Tidalisk','Água','Sombra',58,60,52,48,5,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Tidalisk',false),
('Umbrapaw','Sombra',NULL,52,66,44,62,4,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Umbrapaw',false),
('Voltrix','Elétrico','Metal',56,68,60,64,3,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Voltrix',false),
('Psybloom','Psíquico','Planta',60,58,56,58,3,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Psybloom',false),
('Ferronaut','Metal',NULL,70,64,82,30,3,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Ferronaut',false),
('Glacierra','Gelo','Psíquico',66,70,68,54,2,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Glacierra',false),
('Vulcanox','Fogo','Metal',78,88,74,52,1.2,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Vulcanox',false),
('Abyssarai','Água','Sombra',80,84,72,66,1,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Abyssarai',false),
('Aureon','Psíquico','Voador',88,92,80,86,0.5,'https://api.dicebear.com/9.x/bottts-neutral/svg?seed=Aureon',false);

INSERT INTO public.regions (nome, descricao, nivel_minimo, nivel_maximo, species_ids, multiplicador_raridade) VALUES
('Campina Esmeralda','Prados calmos, perfeitos para os primeiros passos.',1,10,'{1,2,3,4,5,6,7}',1.0),
('Floresta Sussurrante','Mata densa onde criaturas raras se escondem.',8,22,'{3,6,7,8,11,13,10}',1.4),
('Caverna Cintilante','Túneis de cristal com ecos elétricos.',18,35,'{5,9,12,14,11,8}',1.8),
('Pico Vulcânico','Território hostil de criaturas lendárias.',30,50,'{9,12,15,16,17,18,14}',2.4);