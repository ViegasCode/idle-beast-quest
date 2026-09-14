GRANT SELECT, INSERT, UPDATE, DELETE ON public.player_progress TO authenticated;
GRANT ALL ON public.player_progress TO service_role;

ALTER TABLE public.player_progress ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own player progress"
ON public.player_progress
FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);