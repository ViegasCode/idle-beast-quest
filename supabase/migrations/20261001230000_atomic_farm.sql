-- Apply before deploying the new server code. Trusted server uses service_role only.
ALTER TABLE public.capture_items ADD COLUMN IF NOT EXISTS categoria text NOT NULL DEFAULT 'capture';
UPDATE public.capture_items SET categoria = 'boss_key' WHERE id = 4;
ALTER TABLE public.capture_items ADD CONSTRAINT capture_items_categoria_check
  CHECK (categoria IN ('capture', 'boss_key'));
CREATE TABLE public.farm_sessions (
  user_id uuid PRIMARY KEY REFERENCES public.profiles(id) ON DELETE CASCADE,
  revision bigint NOT NULL DEFAULT 0,
  state jsonb,
  pending jsonb,
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.farm_sessions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.farm_sessions TO authenticated;
GRANT ALL ON public.farm_sessions TO service_role;
CREATE POLICY "own farm read" ON public.farm_sessions FOR SELECT TO authenticated USING (auth.uid() = user_id);
-- Direct-write restriction is a separate post-deployment migration for safe rollout.

CREATE OR REPLACE FUNCTION public.farm_snapshot(p_user_id uuid) RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.farm_sessions; result jsonb;
BEGIN
  IF NOT EXISTS (SELECT 1 FROM profiles WHERE id = p_user_id) THEN
    RETURN jsonb_build_object('profile', null);
  END IF;
  INSERT INTO farm_sessions(user_id) VALUES (p_user_id) ON CONFLICT DO NOTHING;
  SELECT * INTO f FROM farm_sessions WHERE user_id = p_user_id FOR UPDATE;
  SELECT jsonb_build_object(
    'profile', (SELECT to_jsonb(p) FROM profiles p WHERE id=p_user_id),
    'session', (SELECT to_jsonb(s) FROM hunting_sessions s WHERE user_id=p_user_id),
    'farm', to_jsonb(f),
    'creatures', COALESCE((SELECT jsonb_agg(to_jsonb(c) ORDER BY capturada_em DESC) FROM creatures c WHERE user_id=p_user_id),'[]'),
    'regions', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY nivel_minimo,id) FROM regions r),'[]'),
    'species', COALESCE((SELECT jsonb_agg(to_jsonb(s) ORDER BY id) FROM species s),'[]'),
    'items', COALESCE((SELECT jsonb_agg(to_jsonb(i) ORDER BY tier,id) FROM capture_items i),'[]'),
    'inventory', COALESCE((SELECT jsonb_agg(to_jsonb(i)) FROM user_items i WHERE user_id=p_user_id),'[]'),
    'serverNow', clock_timestamp()
  ) INTO result;
  RETURN result;
END $$;

CREATE OR REPLACE FUNCTION public.farm_commit(p_user_id uuid, p_revision bigint, p_payload jsonb)
RETURNS boolean LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE f public.farm_sessions; entry jsonb; team uuid[]; leader uuid;
BEGIN
  SELECT * INTO f FROM farm_sessions WHERE user_id=p_user_id FOR UPDATE;
  IF NOT FOUND OR f.revision <> p_revision THEN RETURN false; END IF;
  team := ARRAY(SELECT jsonb_array_elements_text(p_payload->'teamIds')::uuid);
  IF cardinality(team) NOT BETWEEN 1 AND 3 OR cardinality(team) <> (SELECT count(DISTINCT x) FROM unnest(team) x)
    OR (SELECT count(*) FROM creatures WHERE user_id=p_user_id AND id=ANY(team)) <> cardinality(team) THEN
    RAISE EXCEPTION 'Invalid team ownership';
  END IF;
  leader := team[1];
  IF NOT EXISTS (SELECT 1 FROM regions WHERE id=(p_payload->>'regionId')::integer
    AND (p_payload->>'phase')::integer BETWEEN 1 AND fases) THEN
    RAISE EXCEPTION 'Invalid farm region or phase';
  END IF;
  UPDATE hunting_sessions SET creature_id=leader, region_id=(p_payload->>'regionId')::integer,
    fase=(p_payload->>'phase')::integer, fase_kills=0,
    kills_total=(p_payload->>'killsTotal')::integer, exp_total=(p_payload->>'expTotal')::bigint,
    ultima_resolucao_em=(p_payload->>'resolvedAt')::timestamptz,
    ultima_coleta_em=(p_payload->>'collectedAt')::timestamptz,
    pressao=COALESCE((p_payload->>'pressure')::numeric,0),
    pending_species_id=(p_payload->'pending'->>'species_id')::integer,
    pending_nivel=(p_payload->'pending'->>'nivel')::integer,
    pending_expira_em=(p_payload->'pending'->>'expira_em')::timestamptz
  WHERE user_id=p_user_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Missing hunting session'; END IF;
  UPDATE profiles SET active_team_ids=team, auto_captura=(p_payload->>'autoCapture')::boolean,
    repetir_fase=true, fase_repetir=(p_payload->>'phase')::integer WHERE id=p_user_id;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_payload->'creatureUpdates') LOOP
    UPDATE creatures SET nivel=(entry->>'nivel')::integer, exp=(entry->>'exp')::integer
      WHERE user_id=p_user_id AND id=(entry->>'id')::uuid;
    IF NOT FOUND THEN RAISE EXCEPTION 'Invalid creature owner'; END IF;
  END LOOP;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_payload->'inventory') LOOP
    IF (entry->>'quantidade')::integer < 0 THEN RAISE EXCEPTION 'Negative inventory'; END IF;
    INSERT INTO user_items(user_id,item_id,quantidade)
      VALUES(p_user_id,(entry->>'item_id')::integer,(entry->>'quantidade')::integer)
      ON CONFLICT(user_id,item_id) DO UPDATE SET quantidade=EXCLUDED.quantidade;
  END LOOP;
  FOR entry IN SELECT value FROM jsonb_array_elements(p_payload->'captures') LOOP
    INSERT INTO creatures(user_id,species_id,nivel,iv_hp,iv_ataque,iv_defesa,iv_velocidade,nature,raridade,is_shiny)
      VALUES(p_user_id,(entry->>'species_id')::integer,(entry->>'nivel')::integer,
        (entry->>'iv_hp')::integer,(entry->>'iv_ataque')::integer,(entry->>'iv_defesa')::integer,
        (entry->>'iv_velocidade')::integer,entry->>'nature',entry->>'raridade',(entry->>'is_shiny')::boolean);
  END LOOP;
  UPDATE farm_sessions SET revision=revision+1, state=p_payload->'state',
    pending=NULLIF(p_payload->'pending','null'::jsonb), updated_at=clock_timestamp() WHERE user_id=p_user_id;
  RETURN true;
END $$;

CREATE OR REPLACE FUNCTION public.farm_choose_starter(p_user_id uuid,p_species_id integer,p_creature jsonb)
RETURNS void LANGUAGE plpgsql SECURITY DEFINER SET search_path = public AS $$
DECLARE p public.profiles; c_id uuid; r_id integer;
BEGIN
  SELECT * INTO p FROM profiles WHERE id=p_user_id FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Create profile first'; END IF;
  IF p.starter_escolhido THEN RAISE EXCEPTION 'Starter already chosen'; END IF;
  IF NOT EXISTS (SELECT 1 FROM species WHERE id=p_species_id AND is_starter) THEN RAISE EXCEPTION 'Invalid starter'; END IF;
  INSERT INTO creatures(user_id,species_id,nivel,iv_hp,iv_ataque,iv_defesa,iv_velocidade,nature,raridade,is_shiny)
    VALUES(p_user_id,p_species_id,5,(p_creature->>'iv_hp')::integer,(p_creature->>'iv_ataque')::integer,
      (p_creature->>'iv_defesa')::integer,(p_creature->>'iv_velocidade')::integer,
      p_creature->>'nature','Incomum',(p_creature->>'is_shiny')::boolean) RETURNING id INTO c_id;
  SELECT id INTO r_id FROM regions ORDER BY nivel_minimo,id LIMIT 1;
  IF r_id IS NULL THEN RAISE EXCEPTION 'No region'; END IF;
  INSERT INTO hunting_sessions(user_id,creature_id,region_id) VALUES(p_user_id,c_id,r_id);
  INSERT INTO user_items(user_id,item_id,quantidade) VALUES(p_user_id,1,5);
  UPDATE profiles SET starter_escolhido=true,active_team_ids=ARRAY[c_id],unlocked_floors=ARRAY[r_id] WHERE id=p_user_id;
  INSERT INTO farm_sessions(user_id) VALUES(p_user_id) ON CONFLICT DO NOTHING;
END $$;

-- SECURITY DEFINER functions are executable by PUBLIC unless explicitly revoked.
REVOKE ALL ON FUNCTION public.farm_snapshot(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.farm_commit(uuid,bigint,jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.farm_choose_starter(uuid,integer,jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.farm_snapshot(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.farm_commit(uuid,bigint,jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.farm_choose_starter(uuid,integer,jsonb) TO service_role;
