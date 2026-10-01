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
};
export type FarmUnit = {
  id: string;
  x: number;
  hp: number;
  maxHp: number;
  skills: FarmSkill[];
};
export type FarmEnemy = FarmUnit & { speed: number };
export type FarmState = {
  phaseId: string;
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
  type: "wave" | "skill" | "death" | "defeat";
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
export function advanceFarm(input: FarmState, elapsedMs: number, makeEnemy: EnemyFactory) {
  if (!Number.isFinite(elapsedMs) || elapsedMs < 0 || elapsedMs > 12 * 3600_000) {
    throw new Error("Invalid farm duration");
  }
  const state = structuredClone(input);
  const events: FarmEvent[] = [];
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
      events.push({
        timeMs: state.timeMs,
        type: "wave",
        actorId: "",
        targetIds: state.enemies.map((e) => e.id),
      });
    }
    for (const enemy of state.enemies.filter((e) => e.hp > 0)) {
      const living = state.team.filter((u) => u.hp > 0);
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
        events.push({
          timeMs: state.timeMs,
          type: "skill",
          actorId: actor.id,
          targetIds: hits.map((t) => t.id),
          skillId: skill.id,
          damage: skill.damage,
        });
        for (const target of hits) {
          target.hp = Math.max(0, target.hp - skill.damage);
          if (target.hp === 0) {
            if (allied) state.kills++;
            events.push({ timeMs: state.timeMs, type: "death", actorId: target.id, targetIds: [] });
          }
        }
      }
    };
    // Stable order is intentional for the initial prototype; not gym turn order.
    state.team.forEach((u) => attack(u, state.enemies, true));
    state.enemies.forEach((u) => attack(u, state.team, false));
    if (!state.team.some((u) => u.hp > 0)) {
      state.defeated = true;
      events.push({ timeMs: state.timeMs, type: "defeat", actorId: "", targetIds: [] });
    }
    if (state.enemies.length && !state.enemies.some((e) => e.hp > 0)) {
      state.enemies = [];
      state.nextWaveAt = state.timeMs + 1000;
    }
  }
  state.remainderMs = state.defeated ? 0 : budget;
  return { state, events };
}
