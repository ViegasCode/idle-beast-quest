import assert from "node:assert/strict";
import test from "node:test";
import { readFile, readdir } from "node:fs/promises";
import { PGlite } from "@electric-sql/pglite";
import { resolveGame, type Snapshot } from "./farm-game.ts";
const user = "11111111-1111-4111-8111-111111111111";
const other = "22222222-2222-4222-8222-222222222222";
async function database() {
  const db = new PGlite();
  await db.exec(`CREATE ROLE anon; CREATE ROLE authenticated; CREATE ROLE service_role;
    CREATE SCHEMA auth; CREATE TABLE auth.users(id uuid PRIMARY KEY);
    CREATE FUNCTION auth.uid() RETURNS uuid LANGUAGE sql AS $$ SELECT NULL::uuid $$;
    INSERT INTO auth.users VALUES('${user}'),('${other}');`);
  const root = new URL("../../supabase/migrations/", import.meta.url);
  for (const file of (await readdir(root)).filter((f) => f.endsWith(".sql")).sort())
    await db.exec(await readFile(new URL(file, root), "utf8"));
  await db.query("INSERT INTO profiles(id,nome_treinador) VALUES ($1,$2),($3,$4)", [
    user,
    "Tester",
    other,
    "Other",
  ]);
  const creature = {
    iv_hp: 10,
    iv_ataque: 10,
    iv_defesa: 10,
    iv_velocidade: 10,
    nature: "Ardente",
    is_shiny: false,
  };
  await db.query("SELECT farm_choose_starter($1,1,$2::jsonb)", [user, JSON.stringify(creature)]);
  await db.query("SELECT farm_choose_starter($1,2,$2::jsonb)", [other, JSON.stringify(creature)]);
  return db;
}
async function snap(db: PGlite): Promise<Snapshot> {
  const result = await db.query<{ value: Snapshot }>("SELECT farm_snapshot($1) AS value", [user]);
  return result.rows[0]!.value;
}
async function commit(db: PGlite, s: Snapshot, payload: unknown) {
  const result = await db.query<{ ok: boolean }>("SELECT farm_commit($1,$2,$3::jsonb) AS ok", [
    user,
    s.farm.revision,
    JSON.stringify(payload),
  ]);
  return result.rows[0]!.ok;
}
test("all migrations replay; atomic farm commit accepts once and rejects stale revision", async () => {
  const db = await database();
  try {
    const s = await snap(db);
    s.serverNow = new Date(Date.parse(s.session!.ultima_resolucao_em) + 60000).toISOString();
    const result = resolveGame(s);
    assert.ok(result.payload.killsTotal > 0);
    assert.equal(await commit(db, s, result.payload), true);
    assert.equal(await commit(db, s, result.payload), false);
    const saved = await snap(db);
    assert.equal(saved.session!.fase, 1);
    assert.deepEqual(saved.farm.state, result.payload.state);
    assert.equal(saved.creatures[0]!.exp, result.payload.creatureUpdates[0]!.exp);
  } finally {
    await db.close();
  }
});
test("failed insert rolls back HP, revision, EXP and inventory writes", async () => {
  const db = await database();
  try {
    const s = await snap(db);
    const result = resolveGame(s);
    result.payload.inventory[0]!.quantidade = 888;
    result.payload.captures.push({
      species_id: 999999,
      nivel: 1,
      iv_hp: 0,
      iv_ataque: 0,
      iv_defesa: 0,
      iv_velocidade: 0,
      nature: "Ardente",
      raridade: "Comum",
      is_shiny: false,
    });
    await assert.rejects(() => commit(db, s, result.payload));
    const saved = await snap(db);
    assert.equal(saved.farm.revision, s.farm.revision);
    assert.deepEqual(saved.inventory, s.inventory);
    assert.deepEqual(saved.creatures, s.creatures);
  } finally {
    await db.close();
  }
});
test("authenticated role cannot mutate game data or execute trusted RPC", async () => {
  const db = await database();
  try {
    await db.exec("SET ROLE authenticated");
    for (const sql of [
      "UPDATE creatures SET nivel=100",
      "UPDATE user_items SET quantidade=999",
      "UPDATE hunting_sessions SET fase=8",
      "UPDATE profiles SET unlocked_floors=ARRAY[1,2,3,4]",
      `SELECT farm_snapshot('${user}')`,
    ])
      await assert.rejects(() => db.exec(sql));
    await db.exec("RESET ROLE");
  } finally {
    await db.close();
  }
});
test("duplicate starter grants one starter and kit; foreign creature rejected", async () => {
  const db = await database();
  try {
    await assert.rejects(() =>
      db.query("SELECT farm_choose_starter($1,2,$2::jsonb)", [user, "{}"]),
    );
    const s = await snap(db);
    assert.equal(s.creatures.length, 1);
    assert.equal(s.inventory[0]!.quantidade, 5);
    const foreign = await db.query<{ id: string }>("SELECT id FROM creatures WHERE user_id=$1", [
      other,
    ]);
    assert.throws(() => resolveGame(s, { type: "team", ids: [foreign.rows[0]!.id] }));
    const result = resolveGame(s);
    result.payload.teamIds = [foreign.rows[0]!.id];
    await assert.rejects(() => commit(db, s, result.payload));
  } finally {
    await db.close();
  }
});
test("manual target keeps origin chance and cannot be processed twice or with a key", async () => {
  const db = await database();
  try {
    const s = await snap(db);
    s.farm.pending = {
      id: "unique-target",
      species_id: 1,
      nivel: 2,
      chance: 0.4,
      expira_em: new Date(Date.parse(s.serverNow) + 45000).toISOString(),
    };
    s.inventory.push({
      user_id: user,
      item_id: 4,
      quantidade: 9,
      created_at: s.serverNow,
      updated_at: s.serverNow,
    });
    assert.throws(() => resolveGame(s, { type: "capture", targetId: "unique-target", itemId: 4 }));
    const result = resolveGame(s, { type: "capture", targetId: "unique-target", itemId: 1 });
    assert.equal(result.payload.pending, null);
    assert.equal(result.payload.inventory.find((v) => v.item_id === 4)!.quantidade, 9);
    assert.equal(await commit(db, s, result.payload), true);
    assert.throws(() =>
      resolveGame(
        { ...s, farm: { ...s.farm, pending: null } },
        { type: "capture", targetId: "unique-target", itemId: 1 },
      ),
    );
    assert.equal(await commit(db, s, result.payload), false);
  } finally {
    await db.close();
  }
});
test("online batches match offline state, XP, captures and items", async () => {
  const db = await database();
  try {
    const initial = await snap(db);
    initial.profile!.auto_captura = true;
    const start = Date.parse(initial.session!.ultima_resolucao_em);
    const offline = resolveGame({ ...initial, serverNow: new Date(start + 60000).toISOString() });
    const current = structuredClone(initial);
    const captures = [];
    for (let i = 1; i <= 30; i++) {
      current.serverNow = new Date(start + i * 2000).toISOString();
      const result = resolveGame(current);
      captures.push(...result.payload.captures);
      current.farm.state = result.payload.state;
      current.farm.pending = result.payload.pending;
      current.session = { ...current.session!, ...result.view.session };
      current.creatures = result.view.creatures.map(({ species: _, ...c }) => c);
      current.inventory = result.payload.inventory.map((v) => ({
        ...v,
        user_id: user,
        created_at: initial.serverNow,
        updated_at: initial.serverNow,
      }));
    }
    assert.deepEqual(current.farm.state, offline.payload.state);
    assert.equal(current.session!.exp_total, offline.payload.expTotal);
    assert.deepEqual(
      current.inventory.map((v) => ({ item_id: v.item_id, quantidade: v.quantidade })),
      offline.payload.inventory,
    );
    assert.deepEqual(captures, offline.payload.captures);
  } finally {
    await db.close();
  }
});

test("three owned members earn XP; benching preserves damaged HP", async () => {
  const db = await database();
  try {
    const before = await snap(db);
    await db.query(
      `INSERT INTO creatures(user_id,species_id,nivel,iv_hp,iv_ataque,iv_defesa,iv_velocidade,nature)
      SELECT user_id,2,nivel,iv_hp,iv_ataque,iv_defesa,iv_velocidade,nature FROM creatures WHERE id=$1`,
      [before.creatures[0]!.id],
    );
    await db.query(
      `INSERT INTO creatures(user_id,species_id,nivel,iv_hp,iv_ataque,iv_defesa,iv_velocidade,nature)
      SELECT user_id,3,nivel,iv_hp,iv_ataque,iv_defesa,iv_velocidade,nature FROM creatures WHERE id=$1`,
      [before.creatures[0]!.id],
    );
    const s = await snap(db);
    const all = s.creatures.map((c) => c.id);
    assert.equal(all.length, 3);
    s.profile!.active_team_ids = all;
    s.serverNow = new Date(Date.parse(s.session!.ultima_resolucao_em) + 60000).toISOString();
    const result = resolveGame(s);
    assert.ok(result.payload.creatureUpdates.every((c) => c.nivel > 5 || c.exp > 0));
    const next = structuredClone(s);
    next.farm.state = result.payload.state;
    next.farm.state.team[1]!.hp = 1;
    next.session!.ultima_resolucao_em = s.serverNow;
    const benched = resolveGame(next, { type: "team", ids: [all[0]!] });
    next.farm.state = benched.payload.state;
    next.profile!.active_team_ids = [all[0]!];
    const restored = resolveGame(next, { type: "team", ids: all });
    assert.equal(restored.payload.state.team[1]!.hp, 1);
  } finally {
    await db.close();
  }
});

test("phase change settles pending XP then resets growth; locked map and gym reject", async () => {
  const db = await database();
  try {
    const s = await snap(db);
    s.serverNow = new Date(Date.parse(s.session!.ultima_resolucao_em) + 60000).toISOString();
    const result = resolveGame(s, { type: "phase", phase: 2 });
    assert.ok(result.payload.expTotal > 0);
    assert.equal(result.payload.phase, 2);
    assert.equal(result.payload.state.kills, 0);
    assert.throws(() => resolveGame(s, { type: "region", regionId: 2 }));
    assert.throws(() => resolveGame(s, { type: "phase", phase: 9 }));
  } finally {
    await db.close();
  }
});

test("offline caps at twelve hours and discards excess without changing rewards", async () => {
  const db = await database();
  try {
    const s = await snap(db);
    s.creatures[0]!.nivel = 100;
    s.profile!.auto_captura = true;
    const start = Date.parse(s.session!.ultima_resolucao_em);
    const twelve = resolveGame({ ...s, serverNow: new Date(start + 12 * 3600000).toISOString() });
    const day = resolveGame({ ...s, serverNow: new Date(start + 24 * 3600000).toISOString() });
    assert.deepEqual(day.payload.state, twelve.payload.state);
    assert.deepEqual(day.payload.inventory, twelve.payload.inventory);
    assert.deepEqual(day.payload.captures, twelve.payload.captures);
    assert.equal(day.view.resumo.tempoPerdidoMs, 12 * 3600000);
    assert.equal(day.view.resumo.segundos, 12 * 3600);
    assert.ok(day.view.events.length <= 160);
  } finally {
    await db.close();
  }
});
