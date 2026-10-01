# Farm engine — first implementation

Integration update: the server adapter, transactional RPCs and functional FarmArena are now implemented. See [farm-rollout.md](farm-rollout.md) for current activation requirements and remaining gym/passive/minimum-enemy UI work. The checklist below describes the original foundation handoff.

Confirmed rules: 1–3 selected creatures (three slots, starters can use one), fixed allied positions; enemies approach; four active slots per creature; independent cooldown and range; configurable minimum of 1–6 living enemies; at least one in range; area attacks hit all living enemies. Wave size is `min(6, 1 + floor(kills / 20))`, evaluated when spawning. Changing phase resets kills.

`src/lib/farm.ts` is a pure serializable simulation, with a 100ms tick and preserved fractional time. Online and offline must call this same engine. Enemy creation must be deterministic by wave/index. Positions are abstract arena units, mapped to pixels by the view. The view animates events; it must not calculate rewards or run a competing random simulation.

Prototype defaults, not final balancing: nearest target; all enemies dead before next wave; 1s inter-wave pause; stable allied slot order then enemy order; allies do not move; defeated team stops; cooldown begins after activation. Recovery, XP distribution, damage formulas, passive effects and skill catalogue require integration/specification. Skill damage is currently supplied by the caller, not the legacy damage formula. Passives are not implemented by this engine yet.

## Integration still required before replacing live farm

1. Reconcile remote schema and missing player_progress DDL. Do not assume generated types are a migration.
2. Add durable farm state, version and timestamp. Resolve pending interval before switching phase/team.
3. Restrict direct game writes and persist state plus inventory/XP/captures atomically, with concurrency control and idempotency. Existing RLS ownership alone does not protect resource values.
4. Load all selected creatures with actual attributes and per-creature move configuration. Define healing/defeat and XP policy.
5. Replace normal-phase auto-advance with staying on selected phase. Gym is a separate future turn-based engine.
6. Emit capped recent events for rendering and aggregated offline results. Avoid storing twelve hours of animation logs.
7. Replace CombatArena's independent simulation after server integration; then ask Lovable to build fixed left-side team, approaching enemies and individual panels.

No migration is applied and current production combat is unchanged by this foundation PR. This avoids deploying an incomplete reward path.

## Development

Use Node 24 and npm. `npm ci`, `npm test`, `npm run typecheck`, `npm run build`. npm lockfile is authoritative; existing Bun lockfile is legacy and should not be used for this delivery. Existing repository-wide lint issues are not silently reformatted here.
