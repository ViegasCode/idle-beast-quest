import assert from "node:assert/strict";
import test from "node:test";

import {
  createDefaultProgress,
  getAvailablePhases,
  getBossPhaseNumber,
  isBossPhase,
  isBossUnlocked,
  registerBossVictory,
  requireBossKey,
} from "./progression.ts";

test("jogador começa com o andar 1 desbloqueado e sem chave de boss", () => {
  const progress = createDefaultProgress();

  assert.deepEqual(progress.unlockedFloors, [1]);
  assert.equal(progress.currentFloor, 1);
  assert.equal(isBossUnlocked(progress, 1), false);
  assert.equal(requireBossKey(progress, 1), 0);
});

test("fases normais permanecem disponíveis e o boss exige chave", () => {
  const progress = createDefaultProgress();
  const phases = getAvailablePhases(1, progress);

  assert.deepEqual(phases, [1]);
  assert.equal(isBossPhase(2, 1), true);
  assert.equal(isBossUnlocked(progress, 1), false);
});

test("a chave do boss é usada como drop e desbloqueia o boss", () => {
  const progress = createDefaultProgress();

  progress.bossKeys[1] = 1;

  assert.deepEqual(getAvailablePhases(1, progress), [1, 2]);
  assert.equal(isBossUnlocked(progress, 1), true);
  assert.equal(requireBossKey(progress, 1), 1);
});

test("derrotar o boss pela primeira vez desbloqueia o próximo andar sem perder os anteriores", () => {
  const progress = createDefaultProgress();
  progress.bossKeys[1] = 1;

  const next = registerBossVictory(progress, 1);

  assert.deepEqual(next.unlockedFloors, [1, 2]);
  assert.deepEqual(next.bossesDefeated, [1]);
  assert.equal(next.currentFloor, 1);
  assert.equal(isBossUnlocked(next, 1), false);
});
