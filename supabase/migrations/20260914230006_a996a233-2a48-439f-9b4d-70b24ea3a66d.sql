ALTER TABLE public.profiles
ADD COLUMN active_team_ids uuid[] NOT NULL DEFAULT '{}'::uuid[];

ALTER TABLE public.profiles
ADD CONSTRAINT profiles_active_team_size CHECK (cardinality(active_team_ids) <= 3);