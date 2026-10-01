import assert from "node:assert/strict";
import test from "node:test";
import {
  advanceFarm,
  changeFarmPhase,
  createFarm,
  waveSize,
  type FarmUnit,
  type FarmEnemy,
} from "./farm.ts";
const unit = (id = "ally", damage = 10, range = 10): FarmUnit => ({
  id,
  x: 0,
  hp: 100,
  maxHp: 100,
  skills: [{ id: "hit", damage, range, minEnemies: 1, area: false, cooldownMs: 1000, readyAt: 0 }],
});
const enemy = (): FarmEnemy => ({ ...unit("enemy", 1, 0), x: 10, speed: 1 });
test("wave boundaries and six enemy cap", () => {
  assert.deepEqual(
    [0, 19, 20, 39, 40, 79, 80, 99, 100, 1000].map(waveSize),
    [1, 1, 2, 2, 3, 4, 5, 5, 6, 6],
  );
});
test("all three members act independently and stay fixed", () => {
  const result = advanceFarm(createFarm("1", [unit("a"), unit("b"), unit("c")]), 100, enemy);
  assert.deepEqual(
    result.events.filter((e) => e.type === "skill").map((e) => e.actorId),
    ["a", "b", "c"],
  );
  assert.deepEqual(
    result.state.team.map((u) => u.x),
    [0, 0, 0],
  );
  assert.equal(result.state.enemies[0]?.hp, 70);
});
test("ready skill waits for range without consuming cooldown", () => {
  const start = createFarm("1", [unit("a", 10, 1)]);
  const waiting = advanceFarm(start, 100, enemy).state;
  assert.equal(waiting.team[0]?.skills[0]?.readyAt, 0);
  assert.equal(waiting.enemies[0]?.hp, 100);
  const hit = advanceFarm(waiting, 9000, enemy);
  assert.ok(hit.events.some((e) => e.type === "skill" && e.actorId === "a"));
});
test("area counts all living enemies and hits outside range after one enters", () => {
  const start = createFarm("1", [unit()]);
  start.kills = 60;
  start.team[0]!.skills[0] = { ...start.team[0]!.skills[0]!, area: true, minEnemies: 4, range: 1 };
  const result = advanceFarm(start, 100, (_, i) => ({
    ...enemy(),
    x: i === 0 ? 0.5 : 20,
    speed: 0,
  }));
  assert.equal(result.events.find((e) => e.type === "skill")?.targetIds.length, 4);
  assert.deepEqual(
    result.state.enemies.map((e) => e.hp),
    [90, 90, 90, 90],
  );
});
test("minimum living enemies blocks even when one is in range", () => {
  const start = createFarm("1", [unit()]);
  start.team[0]!.skills[0]!.minEnemies = 2;
  const result = advanceFarm(start, 100, enemy);
  assert.equal(result.state.team[0]?.skills[0]?.readyAt, 0);
});
test("threshold increases next wave only; phase switch resets growth", () => {
  const start = createFarm("1", [unit("a", 100)]);
  start.kills = 19;
  const first = advanceFarm(start, 100, enemy).state;
  assert.equal(first.kills, 20);
  assert.equal(first.wave, 1);
  const next = advanceFarm(first, 1000, enemy);
  assert.equal(next.events.find((e) => e.type === "wave")?.targetIds.length, 2);
  assert.equal(changeFarmPhase(next.state, "2").kills, 0);
});
test("batching preserves state and events, including fractional ticks", () => {
  const start = createFarm("1", [unit("a", 20)]);
  const whole = advanceFarm(start, 12057, enemy);
  let current = start;
  const events = [];
  for (const ms of [17, 40, 3000, 4000, 5000]) {
    const result = advanceFarm(current, ms, enemy);
    current = result.state;
    events.push(...result.events);
  }
  assert.deepEqual(current, whole.state);
  assert.deepEqual(events, whole.events);
});
test("dead targets cannot reward multiple kills and defeated team stops", () => {
  const start = createFarm("1", [unit("a", 100), unit("b", 100)]);
  assert.equal(advanceFarm(start, 100, enemy).state.kills, 1);
  const weak = createFarm("1", [{ ...unit("a", 1, 0), hp: 1 }]);
  const loss = advanceFarm(weak, 100, () => ({ ...enemy(), x: 0, speed: 0 }));
  assert.equal(loss.state.defeated, true);
  assert.equal(advanceFarm(loss.state, 1000, enemy).events.length, 0);
});
test("reject invalid configuration and excessive offline interval", () => {
  assert.throws(() => createFarm("1", [unit("a"), unit("a")]));
  assert.throws(() => advanceFarm(createFarm("1", [unit()]), 13 * 3600_000, enemy));
});
