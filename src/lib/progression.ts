export type FloorProgress = {
  currentFloor: number;
  unlockedFloors: number[];
  bossesDefeated: number[];
  bossKeys: Record<number, number>;
};

export const BOSS_KEY_ITEM_ID = 4;

export function createDefaultProgress(): FloorProgress {
  return {
    currentFloor: 1,
    unlockedFloors: [1],
    bossesDefeated: [],
    bossKeys: {},
  };
}

export function parseProgress(value: unknown): FloorProgress {
  const base = createDefaultProgress();
  if (!value || typeof value !== "object") return base;

  const record = value as Record<string, unknown>;
  const unlockedFloors = normalizeUnlockedFloors(
    Array.isArray(record["unlockedFloors"]) ? (record["unlockedFloors"] as number[]) : base.unlockedFloors,
  );
  const currentFloor = Number(record["currentFloor"] ?? base.currentFloor) || base.currentFloor;

  const bossKeys =
    record["bossKeys"] && typeof record["bossKeys"] === "object"
      ? Object.fromEntries(
          Object.entries(record["bossKeys"] as Record<string, unknown>).map(([key, value]) => [
            Number(key),
            Math.max(0, Number(value) || 0),
          ]),
        )
      : {};

  return {
    currentFloor: Math.max(1, currentFloor),
    unlockedFloors: unlockedFloors.length ? unlockedFloors : base.unlockedFloors,
    bossesDefeated: normalizeBossesDefeated(
      Array.isArray(record["bossesDefeated"]) ? (record["bossesDefeated"] as number[]) : base.bossesDefeated,
    ),
    bossKeys,
  };
}

export function normalizeUnlockedFloors(floors: number[] | null | undefined): number[] {
  const list = Array.isArray(floors) ? floors.filter((floor) => Number.isFinite(floor) && floor > 0) : [];
  return [...new Set(list)].sort((a, b) => a - b);
}

export function normalizeBossesDefeated(defeated: number[] | null | undefined): number[] {
  const list = Array.isArray(defeated)
    ? defeated.filter((floor) => Number.isFinite(floor) && floor > 0)
    : [];
  return [...new Set(list)].sort((a, b) => a - b);
}

export function isFloorUnlocked(progress: Pick<FloorProgress, "unlockedFloors">, floor: number): boolean {
  return normalizeUnlockedFloors(progress.unlockedFloors).includes(floor);
}

export function getBossPhaseNumber(faseCount: number): number {
  return Math.max(1, Number(faseCount) + 1);
}

export function isBossPhase(selectedPhase: number, faseCount: number): boolean {
  return selectedPhase === getBossPhaseNumber(faseCount);
}

export function getAvailablePhases(
  floor: number,
  progress: Pick<FloorProgress, "unlockedFloors" | "bossKeys">,
): number[] {
  const unlocked = isFloorUnlocked(progress, floor);
  if (!unlocked) return [];

  const regular = Array.from({ length: Math.max(1, floor) }, (_, index) => index + 1);
  const bossPhase = getBossPhaseNumber(Math.max(1, floor));
  const bossKey = Number(progress.bossKeys[floor] ?? 0) || 0;

  return bossKey > 0 ? [...regular, bossPhase] : regular;
}

export function getBossPhaseName(floor: number): string {
  return `Boss ${floor}`;
}

export function isBossUnlocked(progress: Pick<FloorProgress, "bossKeys">, floor: number): boolean {
  return Number(progress.bossKeys[floor] ?? 0) > 0;
}

export function requireBossKey(progress: Pick<FloorProgress, "bossKeys">, floor: number): number {
  return Number(progress.bossKeys[floor] ?? 0);
}

export function consumeBossKey(progress: FloorProgress, floor: number): FloorProgress {
  const next = { ...progress, bossKeys: { ...progress.bossKeys } };
  const current = Number(next.bossKeys[floor] ?? 0);
  next.bossKeys[floor] = Math.max(0, current - 1);
  return next;
}

export function registerBossVictory(progress: FloorProgress, floor: number): FloorProgress {
  const nextUnlocked = normalizeUnlockedFloors(progress.unlockedFloors);
  const nextBosses = normalizeBossesDefeated(progress.bossesDefeated);
  const nextBossesSet = new Set(nextBosses);
  nextBossesSet.add(floor);

  if (!nextUnlocked.includes(floor + 1)) {
    nextUnlocked.push(floor + 1);
  }

  const next = {
    ...progress,
    currentFloor: progress.currentFloor || 1,
    unlockedFloors: normalizeUnlockedFloors(nextUnlocked),
    bossesDefeated: normalizeBossesDefeated([...nextBossesSet]),
    bossKeys: { ...progress.bossKeys },
  };

  next.bossKeys[floor] = 0;
  return next;
}
