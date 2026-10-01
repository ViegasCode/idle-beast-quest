/** Authoritative, serializable farm simulation. Positions use arena units, not pixels. */
export const FARM_TICK_MS = 100;
export const MAX_WAVE_ENEMIES = 6;
export type FarmSkill = {
  id: string;
  cooldownMs: number;
  range: number;
  minEnemies: number;
  area: boolean;
  damage: number;
  readyAt: number;
  name?: string;
  type?: string;
  power?: number;
};
export type FarmUnit = {
  id: string;
  x: number;
  hp: number;
  maxHp: number;
  skills: FarmSkill[];
  name?: string;
  sprite?: string | null;
  speciesId?: number;
  level?: number;
  attack?: number;
  defense?: number;
  types?: (string | null)[];
};
export type FarmEnemy = FarmUnit & { speed: number };
export type FarmState = {
  phaseId: string;
  epoch?: number;
  reserves?: Record<string, FarmUnit>;
  timeMs: number;
  remainderMs: number;
  kills: number;
  wave: number;
  nextWaveAt: number;
  defeated: boolean;
  team: FarmUnit[];
  enemies: FarmEnemy[];
};
export type FarmEvent = {
  timeMs: number;
  type: "wave" | "skill" | "hit" | "death" | "defeat";
  actorId: string;
  targetIds: string[];
  skillId?: string;
  damage?: number;
};
export type EnemyFactory = (wave: number, index: number) => FarmEnemy;
export function waveSize(kills: number): number {
  return Math.min(MAX_WAVE_ENEMIES, 1 + Math.floor(Math.max(0, kills) / 20));
}
function validateUnit(unit: FarmUnit) {
  if (
    !unit.id ||
    !Number.isFinite(unit.x) ||
    !Number.isFinite(unit.hp) ||
    !Number.isFinite(unit.maxHp) ||
    unit.maxHp <= 0 ||
    unit.hp < 0 ||
    unit.hp > unit.maxHp
  ) {
    throw new Error("Invalid farm unit");
  }
  if (unit.skills.length > 4 || new Set(unit.skills.map((s) => s.id)).size !== unit.skills.length) {
    throw new Error("Invalid skill slots");
  }
  for (const skill of unit.skills) {
    if (
      !skill.id ||
      !Number.isFinite(skill.cooldownMs) ||
      skill.cooldownMs < FARM_TICK_MS ||
      !Number.isFinite(skill.range) ||
      skill.range < 0 ||
      !Number.isInteger(skill.minEnemies) ||
      skill.minEnemies < 1 ||
      skill.minEnemies > 6 ||
      !Number.isFinite(skill.damage) ||
      skill.damage <= 0 ||
      !Number.isFinite(skill.readyAt) ||
      skill.readyAt < 0
    )
      throw new Error("Invalid farm skill");
  }
}
export function createFarm(phaseId: string, team: FarmUnit[]): FarmState {
  if (
    !phaseId ||
    team.length < 1 ||
    team.length > 3 ||
    new Set(team.map((u) => u.id)).size !== team.length
  ) {
    throw new Error("Invalid farm formation");
  }
  team.forEach(validateUnit);
  return {
    phaseId,
    timeMs: 0,
    remainderMs: 0,
    kills: 0,
    wave: 0,
    nextWaveAt: 0,
    defeated: false,
    team: structuredClone(team),
    enemies: [],
  };
}
/** Switching phase resets wave growth and pending cooldowns; healing is not implicit. */
export function changeFarmPhase(state: FarmState, phaseId: string): FarmState {
  return createFarm(
    phaseId,
    state.team.map((u) => ({
      ...u,
      skills: u.skills.map((s) => ({ ...s, readyAt: 0 })),
    })),
  );
}
/** Same tick order for online and offline. Caller limits elapsed time and persists atomically.
 * Enemy factory must be deterministic from wave/index, without Date.now or Math.random.
 * Dead teams stop the session; recovery and rewards are handled by the integration layer.
 */
export type FarmOptions = {
  eventLimit?: number;
  damageFor?: (actor: FarmUnit, target: FarmUnit, skill: FarmSkill, state: FarmState) => number;
  onEnemyDeath?: (enemy: FarmEnemy, state: FarmState) => void;
  onWaveComplete?: (state: FarmState) => void;
};
export function advanceFarm(
  input: FarmState,
  elapsedMs: number,
  makeEnemy: EnemyFactory,
  options: FarmOptions = {},
) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > 12 * 3600_000) {
    throw new Error("Invalid farm duration");
  }
  const state = structuredClone(input);
  const events: FarmEvent[] = [];
  const emit = (event: FarmEvent) => {
    events.push(event);
    if (options.eventLimit !== undefined && events.length > options.eventLimit) events.shift();
  };
  let budget = state.remainderMs + elapsedMs;
  while (budget >= FARM_TICK_MS && !state.defeated) {
    budget -= FARM_TICK_MS;
    state.timeMs += FARM_TICK_MS;
    if (!state.enemies.some((e) => e.hp > 0) && state.timeMs >= state.nextWaveAt) {
      state.wave++;
      state.enemies = Array.from({ length: waveSize(state.kills) }, (_, i) => {
        const enemy = structuredClone(makeEnemy(state.wave, i));
        validateUnit(enemy);
        if (!Number.isFinite(enemy.speed) || enemy.speed < 0)
          throw new Error("Invalid enemy speed");
        enemy.id = `wave-${state.wave}-${i}`;
        enemy.skills.forEach((s) => {
          s.readyAt = state.timeMs;
        });
        return enemy;
      });
      emit({
        timeMs: state.timeMs,
        type: "wave",
        actorId: "",
        targetIds: state.enemies.map((e) => e.id),
      });
    }
    for (const enemy of state.enemies.filter((e) => e.hp > 0)) {
      const living = state.team.filter((u) => u.hp > 0);
      if (!living.length) continue;
      const front = Math.max(...living.map((u) => u.x));
      enemy.x = Math.max(front, enemy.x - (enemy.speed * FARM_TICK_MS) / 1000);
    }
    const attack = (actor: FarmUnit, targets: FarmUnit[], allied: boolean) => {
      if (actor.hp <= 0) return;
      for (const skill of actor.skills) {
        const alive = targets.filter((t) => t.hp > 0);
        const inRange = alive
          .filter((t) => Math.abs(t.x - actor.x) <= skill.range)
          .sort(
            (a, b) => Math.abs(a.x - actor.x) - Math.abs(b.x - actor.x) || a.id.localeCompare(b.id),
          );
        if (skill.readyAt > state.timeMs || alive.length < skill.minEnemies || !inRange.length)
          continue;
        const hits = skill.area ? alive : inRange.slice(0, 1);
        skill.readyAt = state.timeMs + skill.cooldownMs;
        emit({
          timeMs: state.timeMs,
          type: "skill",
          actorId: actor.id,
          targetIds: hits.map((t) => t.id),
          skillId: skill.id,
        });
        for (const target of hits) {
          const damage = options.damageFor?.(actor, target, skill, state) ?? skill.damage;
          target.hp = Math.max(0, target.hp - damage);
          emit({
            timeMs: state.timeMs,
            type: "hit",
            actorId: actor.id,
            targetIds: [target.id],
            skillId: skill.id,
            damage,
          });
          if (target.hp === 0) {
            if (allied) {
              state.kills++;
              options.onEnemyDeath?.(target as FarmEnemy, state);
            }
            emit({ timeMs: state.timeMs, type: "death", actorId: target.id, targetIds: [] });
          }
        }
      }
    };
    // Stable order is intentional for the initial prototype; not gym turn order.
    state.team.forEach((u) => attack(u, state.enemies, true));
    state.enemies.forEach((u) => attack(u, state.team, false));
    if (!state.team.some((u) => u.hp > 0)) {
      state.defeated = true;
      emit({ timeMs: state.timeMs, type: "defeat", actorId: "", targetIds: [] });
    }
    if (state.enemies.length && !state.enemies.some((e) => e.hp > 0)) {
      options.onWaveComplete?.(state);
      state.enemies = [];
      state.nextWaveAt = state.timeMs + 1000;
    }
  }
  state.remainderMs = state.defeated ? 0 : budget;
  return { state, events };
}
