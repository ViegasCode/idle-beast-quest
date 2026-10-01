-- Apply ONLY AFTER deploying the new trusted server handlers.
-- Existing ownership policies are retained for SELECT, but cannot grant revoked writes.
REVOKE INSERT, UPDATE, DELETE ON public.profiles, public.creatures,
  public.hunting_sessions, public.user_items, public.player_progress FROM authenticated, anon;
