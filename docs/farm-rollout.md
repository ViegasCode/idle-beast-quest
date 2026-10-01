# Farm v2 — deployment and Lovable handoff

## Scope

Three individual combatants, real owned stats, four provisional active slots each, stationary allies, approaching enemies, independent range/cooldown, AoE hitting all living enemies after one enters range, and 20-kill wave growth capped at six. Normal phases remain selected indefinitely. Wave growth resets only on phase/map change. Team changes retain phase growth and benched health. Level-ups recalculate stats during offline processing. EXP is split equally across living members, with integer remainder awarded by slot order.

Prototype balancing defaults: existing original-creature data and type moves, basic neutral moves filling four slots; the second move of each type is provisionally area; skills have 2.4/5.2/3.6/7s recargas, range 8 for neutral melee and 45–70 for typed moves. These are not official Pokémon move properties. No passive catalogue yet, so no empty passive slot is displayed. Minimum-enemy config is persisted by the engine but UI editing remains for the next delivery (default 1).

Team recovers 40% max HP after each completed wave, only living members. If all faint, farm stops and awards no further XP until explicit recovery. Recovery restores selected team, preserves abates, and waits 5s before next wave. These recovery/EXP policies are implementation defaults for review.

Server snapshots and returned events are authoritative. The small FarmArena component renders snapshots at 2s intervals, and a short recent event list. It does not simulate damage. Visual animation timing is intentionally basic pending Lovable polish. Enemy paths must remain tied to server positions; no independent random simulation in the UI.

## Safe activation order (do not merge before preparing backend)

1. Back up the database and use a development/preview environment first. Inspect existing player_progress and confirm its columns match the historical bootstrap migration `20260914230020_restore_player_progress.sql`. This migration restores clean database replay; an existing table is left intact. Do not overwrite a differing live schema.
2. Apply additive migration `20261001230000_atomic_farm.sql`: categories, farm_sessions, service-only RPCs. Do not apply `20261001230001_restrict_game_writes.sql` yet: old deployed code still writes using the player token.
3. Ensure **server-only** SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY and SUPABASE_SERVICE_ROLE_KEY are configured in Lovable Cloud. Never use a VITE_ variable for service_role and never paste the secret in chat or commit it. The repo's existing admin client consumes this server environment.
4. Deploy this PR in preview against the prepared schema. Test existing login, new profile/starter, formation, phases, captures and recovery. Once verified, merge/deploy the new handlers to the connected main branch.
5. Apply `20261001230001_restrict_game_writes.sql` immediately after the new deployment is live. This is required for security: additive migration alone does not prevent editing resources directly. The previous backend must no longer serve player writes.
6. Test as two accounts and two tabs. Initial players only access map 1; existing current map remains accessible. Other maps require existing unlocked_floors. Gym is disabled pending turn-engine implementation; it must not be replaced with idle boss progression.

Code merge does not prove SQL migrations or environment configuration were applied. No production database changes were performed from this workspace.

## What the transactions protect

farm_snapshot reads a coherent snapshot under session revision lock. Trusted TypeScript calculates result, then farm_commit locks and compares revision. HP/recargas, XP, inventory, pending target, captures and preferences commit together. Stale callers reload/recalculate up to three times. Manual capture submits immutable target_id, so retry cannot consume a second target. Starter selection locks profile and grants starter/session/kit in one transaction. PUBLIC/authenticated cannot execute trusted RPCs.

Read-only profiles/species/regions/collection remain available. Every trusted server handler derives userId from verified auth context; client cannot choose user identity. Direct browser mutation is revoked only after new code is live.

## Offline

Same deterministic engine for online and offline; fractional ticks retained; duration capped at twelve hours and excess discarded explicitly. Phase/team/preference changes first settle accrued time under old settings. A living pending manual target keeps origin chance and is not replaced; expired targets are not processed. Recent animation events capped at 160; offline rewards remain fully counted. RNG derives from persisted run epoch and wave/kill IDs, not wall-clock request timing.

## Validations

Node tests run actual PostgreSQL migrations and RPCs using PGlite (test-only dependency), including revision conflict, rollback, permissions, duplicate starter, foreign formation, manual target reuse, key exclusion, batch equivalence and phase transitions. This is local SQL validation, not certification of production Supabase environment or latency. Full lint backlog outside touched files remains.

## Prompt for Lovable after backend activation

“Polish the existing FarmArena and lower team panels using getCombatState.farm/events as authoritative data. Keep the three allies stationary at left; enemies approach according to server x. Animate returned skill/hit/death events without calculating new damage, rewards or randomness in the browser. Show actual per-member HP, level, EXP and four active slots with cooldown indicators; no passive empty placeholder. Preserve the server rules and endpoints. Keep gym button disabled. Improve spacing and mobile presentation without changing database, farm-game.ts, farm.server.ts or transaction RPCs.”
