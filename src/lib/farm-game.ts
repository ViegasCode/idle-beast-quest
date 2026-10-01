import {
  combatenteDoJogador,
  GOLPES,
  efetividade,
  expNecessaria,
  expPorAbate,
  hashSeed,
  mulberry32,
  inimigosDaFase,
  sortearRaridade,
  CAP_MS,
} from "./combat.ts";
import {
  createFarm,
  advanceFarm,
  type FarmState,
  type FarmUnit,
  type FarmSkill,
  type FarmEvent,
} from "./farm.ts";
import { getFaseDef } from "./phases.ts";
import { NATURES, SHINY_CHANCE } from "./game.ts";
import type { Tables } from "../integrations/supabase/types.ts";
export type Creature = Tables<"creatures"> & { species: Tables<"species"> };
export type Item = Tables<"capture_items"> & { categoria: "capture" | "boss_key" };
export type Pending = {
  id: string;
  species_id: number;
  nivel: number;
  expira_em: string;
  chance: number;
};
export type Snapshot = {
  profile: Tables<"profiles"> | null;
  session: Tables<"hunting_sessions"> | null;
  farm: { revision: number; state: FarmState | null; pending: Pending | null };
  creatures: Tables<"creatures">[];
  species: Tables<"species">[];
  regions: Tables<"regions">[];
  items: Item[];
  inventory: Tables<"user_items">[];
  serverNow: string;
};
export type Action =
  | { type: "resolve" | "summary" | "restart" }
  | { type: "phase"; phase: number }
  | { type: "region"; regionId: number }
  | { type: "team"; ids: string[] }
  | { type: "auto"; active: boolean }
  | { type: "capture"; targetId: string; itemId: number | null };
export function makeCapture(
  speciesId: number,
  level: number,
  multiplier: number,
  rng: () => number,
) {
  return {
    species_id: speciesId,
    nivel: level,
    iv_hp: Math.floor(rng() * 32),
    iv_ataque: Math.floor(rng() * 32),
    iv_defesa: Math.floor(rng() * 32),
    iv_velocidade: Math.floor(rng() * 32),
    nature: NATURES[Math.floor(rng() * NATURES.length)]!.nome,
    raridade: sortearRaridade(multiplier, rng),
    is_shiny: rng() < SHINY_CHANCE,
  };
}
function buildUnit(c: Creature, previous?: FarmUnit): FarmUnit {
  const stats = combatenteDoJogador(c);
  const types = [c.species.tipo_primario, c.species.tipo_secundario].filter(
    (t): t is string => !!t,
  );
  const definitions = types.flatMap((type) =>
    (GOLPES[type] ?? []).map((g, i) => ({ name: g.nome, type, power: g.power, area: i === 1 })),
  );
  definitions.push(
    { name: "Investida", type: "Neutro", power: 45, area: false },
    { name: "Impacto", type: "Neutro", power: 55, area: false },
  );
  const skills: FarmSkill[] = definitions.slice(0, 4).map((g, i) => ({
    id: `slot-${i}`,
    name: g.name,
    type: g.type,
    power: g.power,
    cooldownMs: [2400, 5200, 3600, 7000][i]!,
    range: g.type === "Neutro" ? 8 : [55, 70, 45, 60][i]!,
    minEnemies: previous?.skills[i]?.minEnemies ?? 1,
    area: g.area,
    damage: 1,
    readyAt: previous?.skills[i]?.readyAt ?? 0,
  }));
  return {
    id: c.id,
    x: previous?.x ?? 10,
    hp: previous
      ? Math.min(stats.hpMax, previous.hp + Math.max(0, stats.hpMax - previous.maxHp))
      : stats.hpMax,
    maxHp: stats.hpMax,
    skills,
    name: stats.nome,
    sprite: stats.sprite_url,
    speciesId: c.species_id,
    level: c.nivel,
    attack: stats.ataque,
    defense: stats.defesa,
    types: stats.tipos,
  };
}
function damage(actor: FarmUnit, target: FarmUnit, skill: FarmSkill, state: FarmState) {
  const seed = hashSeed(
    state.timeMs,
    ...[actor.id, target.id, skill.id]
      .join("")
      .split("")
      .map((c) => c.charCodeAt(0)),
  );
  const rng = mulberry32(seed);
  const eff = skill.type === "Neutro" ? 1 : efetividade(skill.type ?? "Neutro", target.types ?? []);
  const stab = actor.types?.includes(skill.type ?? "Neutro") ? 1.5 : 1;
  const base =
    (((2 * (actor.level ?? 1)) / 5 + 2) * (actor.attack ?? 1) * (skill.power ?? 45)) /
      Math.max(1, target.defense ?? 1) /
      55 +
    2;
  return Math.max(
    1,
    Math.floor(base * eff * stab * (0.85 + rng() * 0.3) * (rng() < 0.07 ? 1.5 : 1)),
  );
}
export function resolveGame(snapshot: Snapshot, action: Action = { type: "resolve" }) {
  const s = structuredClone(snapshot);
  if (!s.profile || !s.session) throw new Error("Escolha sua criatura inicial primeiro.");
  const profile = s.profile;
  const session = s.session;
  let region = s.regions.find((r) => r.id === session.region_id);
  if (!region) throw new Error("Região não encontrada.");
  let phase = session.fase;
  // Legacy boss is not a turn-based gym. Bring old boss sessions back to last farm phase.
  phase = Math.min(Math.max(1, phase), region.fases);
  const creatures: Creature[] = s.creatures.map((c) => {
    const species = s.species.find((sp) => sp.id === c.species_id);
    if (!species) throw new Error("Espécie ausente.");
    return { ...c, species };
  });
  let ids = profile.active_team_ids.length ? profile.active_team_ids : [session.creature_id];
  const owned = (teamIds: string[]) => {
    if (teamIds.length < 1 || teamIds.length > 3 || new Set(teamIds).size !== teamIds.length)
      throw new Error("Time inválido.");
    return teamIds.map((id) => {
      const c = creatures.find((c) => c.id === id);
      if (!c) throw new Error("Criatura não pertence à coleção.");
      return c;
    });
  };
  let team = owned(ids);
  let farm = s.farm.state;
  const phaseId = `${region.id}:${phase}`;
  if (!farm || farm.phaseId !== phaseId || farm.team.map((u) => u.id).join() !== ids.join())
    farm = createFarm(
      phaseId,
      team.map((c) => buildUnit(c)),
    );
  farm.epoch ??= s.farm.revision;
  farm.reserves ??= {};
  const startWave = farm.wave;
  let waves = 0;
  let defeats = 0;
  // Persisted units preserve cooldowns/HP, while canonical stats come from owned creatures.
  farm.team = team.map((c) =>
    buildUnit(
      c,
      farm!.team.find((u) => u.id === c.id),
    ),
  );
  const now = Date.parse(s.serverNow);
  const elapsed = Math.max(0, now - Date.parse(session.ultima_resolucao_em));
  let pending =
    s.farm.pending && Date.parse(s.farm.pending.expira_em) > now ? s.farm.pending : null;
  const inventory = new Map(
    s.items.map((i) => [i.id, s.inventory.find((v) => v.item_id === i.id)?.quantidade ?? 0]),
  );
  const captures: ReturnType<typeof makeCapture>[] = [];
  const drops = new Map<number, number>();
  let gained = 0,
    kills = 0,
    failed = 0,
    noItems = 0;
  let events: FarmEvent[] = [];
  let manualSuccess = false;
  let usedItem = "";
  const pool = s.species.filter((sp) => region!.species_ids.includes(sp.id));
  const def = getFaseDef(region.id, phase, region.species_ids, region.fases);
  const queue = inimigosDaFase(region, phase, pool, def);
  if (!queue.length) throw new Error("Nenhuma espécie configurada para a fase.");
  const factory = (wave: number, index: number) => {
    const e = queue[(wave - 1 + index) % queue.length]!;
    const c = e.combatente;
    return {
      id: "enemy",
      x: 100 + index * 8,
      hp: c.hpMax,
      maxHp: c.hpMax,
      speed: 9,
      name: c.nome,
      sprite: c.sprite_url,
      speciesId: e.species_id,
      level: e.nivel,
      attack: c.ataque,
      defense: c.defesa,
      types: c.tipos,
      skills: [
        {
          id: "enemy-hit",
          name: "Investida",
          power: 45,
          type: "Neutro",
          range: 8,
          cooldownMs: 2500,
          minEnemies: 1,
          area: false,
          damage: 1,
          readyAt: 0,
        },
      ],
    };
  };
  const available = () =>
    s.items
      .filter((i) => i.categoria === "capture" && (inventory.get(i.id) ?? 0) > 0)
      .sort((a, b) => b.taxa_sucesso - a.taxa_sucesso || a.id - b.id);
  // Manual capture operates on its immutable target; it must not resolve/replace that target first.
  if (action.type === "capture") {
    if (!pending || pending.id !== action.targetId)
      throw new Error("Alvo expirado ou já processado.");
    const item = action.itemId ? available().find((i) => i.id === action.itemId) : available()[0];
    if (!item) throw new Error("Nenhuma esfera disponível.");
    const rng = mulberry32(
      hashSeed(...(pending.id + item.id).split("").map((c) => c.charCodeAt(0))),
    );
    inventory.set(item.id, inventory.get(item.id)! - 1);
    usedItem = item.nome;
    manualSuccess = rng() < Math.min(0.95, pending.chance * item.taxa_sucesso);
    if (manualSuccess)
      captures.push(
        makeCapture(pending.species_id, pending.nivel, region.multiplicador_raridade, rng),
      );
    pending = null;
  } else {
    const result = advanceFarm(farm, Math.min(elapsed, CAP_MS), factory, {
      eventLimit: 160,
      damageFor: damage,
      onEnemyDeath: (enemy, current) => {
        kills++;
        const reward = expPorAbate(enemy.level ?? 1);
        const alive = current.team.filter((u) => u.hp > 0);
        const share = Math.floor(reward / alive.length);
        alive.forEach((u, i) => {
          const c = creatures.find((c) => c.id === u.id)!;
          const xp = share + (i < reward % alive.length ? 1 : 0);
          gained += xp;
          c.exp += xp;
          while (c.nivel < 100 && c.exp >= expNecessaria(c.nivel)) {
            c.exp -= expNecessaria(c.nivel);
            c.nivel++;
          }
          if (c.nivel >= 100) c.exp = 0;
          Object.assign(u, buildUnit(c, u));
        });
        const rng = mulberry32(
          hashSeed(
            region!.id,
            farm!.epoch ?? 0,
            phase,
            current.wave,
            current.kills,
            ...ids
              .join("")
              .split("")
              .map((c) => c.charCodeAt(0)),
          ),
        );
        for (const item of s.items) {
          if (rng() < Math.min(0.95, item.chance_drop * def.dropMult)) {
            inventory.set(item.id, (inventory.get(item.id) ?? 0) + 1);
            drops.set(item.id, (drops.get(item.id) ?? 0) + 1);
          }
        }
        if (profile.auto_captura) {
          const item = available()[0];
          if (!item) {
            noItems++;
            return;
          }
          inventory.set(item.id, inventory.get(item.id)! - 1);
          if (rng() < Math.min(0.95, def.taxaCaptura * item.taxa_sucesso))
            captures.push(
              makeCapture(enemy.speciesId!, enemy.level!, region!.multiplicador_raridade, rng),
            );
          else failed++;
        } else if (!pending) {
          const at = now - Math.min(elapsed, CAP_MS) + current.timeMs - farm!.timeMs;
          if (at + 45000 > now)
            pending = {
              id: `${phaseId}:${farm!.epoch}:${session.iniciado_em}:${current.wave}:${current.kills}`,
              species_id: enemy.speciesId!,
              nivel: enemy.level!,
              chance: def.taxaCaptura,
              expira_em: new Date(at + 45000).toISOString(),
            };
        }
      },
      onWaveComplete: (current) =>
        current.team
          .filter((u) => u.hp > 0)
          .forEach((u) => {
            u.hp = Math.min(u.maxHp, u.hp + Math.ceil(u.maxHp * 0.4));
          }),
    });
    farm = result.state;
    events = result.events;
    waves = farm.wave - startWave;
    defeats = events.filter((e) => e.type === "defeat").length;
    session.ultima_resolucao_em = s.serverNow;
  }
  session.kills_total += kills;
  session.exp_total += gained;
  const reserves = { ...farm.reserves, ...Object.fromEntries(farm.team.map((u) => [u.id, u])) };
  if (action.type === "phase") {
    if (!Number.isInteger(action.phase) || action.phase < 1 || action.phase > region.fases)
      throw new Error("Fase de farm inválida. Ginásio ainda não disponível.");
    if (phase !== action.phase) {
      phase = action.phase;
      farm = createFarm(
        `${region.id}:${phase}`,
        farm.team.map((u) => ({ ...u, skills: u.skills.map((sk) => ({ ...sk, readyAt: 0 })) })),
      );
      pending = null;
      events = [];
    }
  }
  if (action.type === "region") {
    const selected = s.regions.find((r) => r.id === action.regionId);
    if (!selected) throw new Error("Região inválida.");
    if (selected.id !== region.id && !profile.unlocked_floors.includes(selected.id))
      throw new Error("Vença o ginásio para liberar este mapa.");
    if (selected.id !== region.id) {
      region = selected;
      phase = 1;
      farm = createFarm(
        `${region.id}:1`,
        farm.team.map((u) => ({ ...u, skills: u.skills.map((sk) => ({ ...sk, readyAt: 0 })) })),
      );
      pending = null;
      events = [];
    }
  }
  if (action.type === "team") {
    team = owned(action.ids);
    ids = action.ids;
    if (ids.join() !== farm.team.map((u) => u.id).join()) {
      const next = team.map((c) => buildUnit(c, reserves[c.id]));
      // Keep phase abates and health of benched members; first-time participants start at full HP.
      farm.team = next;
      farm.defeated = !next.some((u) => u.hp > 0);
      events = [];
    }
  }
  if (action.type === "restart") {
    if (!farm.defeated) throw new Error("O time ainda está lutando.");
    // Explicit recovery, no rewards while defeated. Preserve phase growth to prevent farming reset exploits.
    farm.team = team.map((c) => buildUnit(c));
    farm.defeated = false;
    farm.enemies = [];
    farm.nextWaveAt = farm.timeMs + 5000;
    pending = null;
    events = [];
  }
  if (action.type === "auto") profile.auto_captura = action.active;
  if (action.type === "summary") {
    session.kills_total = 0;
    session.exp_total = 0;
    session.ultima_coleta_em = s.serverNow;
  }
  farm.reserves = { ...farm.reserves, ...reserves };
  if (farm.epoch === undefined) {
    farm.epoch = s.farm.revision + 1;
    farm.reserves = Object.fromEntries(
      Object.entries(farm.reserves).map(([id, u]) => [
        id,
        { ...u, skills: u.skills.map((sk) => ({ ...sk, readyAt: 0 })) },
      ]),
    );
  }
  const pressure =
    1 -
    farm.team.reduce((n, u) => n + u.hp, 0) /
      Math.max(
        1,
        farm.team.reduce((n, u) => n + u.maxHp, 0),
      );
  return {
    payload: {
      state: farm,
      pending,
      teamIds: ids,
      regionId: region.id,
      phase,
      autoCapture: profile.auto_captura,
      killsTotal: session.kills_total,
      expTotal: session.exp_total,
      resolvedAt: session.ultima_resolucao_em,
      collectedAt: session.ultima_coleta_em,
      pressure,
      creatureUpdates: creatures
        .filter(
          (c) =>
            ids.includes(c.id) ||
            s.profile!.active_team_ids.includes(c.id) ||
            c.id === session.creature_id,
        )
        .map((c) => ({ id: c.id, nivel: c.nivel, exp: c.exp })),
      inventory: [...inventory].map(([item_id, quantidade]) => ({ item_id, quantidade })),
      captures,
    },
    view: {
      profile: { ...profile, active_team_ids: ids },
      session: {
        ...session,
        region_id: region.id,
        fase: phase,
        creature_id: ids[0]!,
        pressao: pressure,
        regions: region,
      },
      regions: s.regions,
      catalogo: s.items,
      serverNow: s.serverNow,
      farm,
      events,
      creatures,
      criatura: creatures.find((c) => c.id === ids[0])!,
      combatente: combatenteDoJogador(creatures.find((c) => c.id === ids[0])!),
      inventario: [...inventory].map(([item_id, quantidade]) => ({ item_id, quantidade })),
      pending: pending
        ? { ...pending, species: s.species.find((sp) => sp.id === pending!.species_id)! }
        : null,
      faseDef: getFaseDef(region.id, phase, region.species_ids, region.fases),
      totalCriaturas: s.creatures.length + captures.length,
      resumo: {
        batalhas: waves,
        kills,
        derrotas: defeats,
        exp: gained,
        segundos: action.type === "capture" ? 0 : Math.floor(Math.min(elapsed, CAP_MS) / 1000),
        tempoPerdidoMs: Math.max(0, elapsed - CAP_MS),
        itens: [...drops].map(([item_id, qtd]) => ({
          item_id,
          qtd,
          nome: s.items.find((i) => i.id === item_id)!.nome,
        })),
        capturadas: captures,
        capturasFalhadas: failed,
        perdidasSemItem: noItems,
      },
    },
    captureResult: { sucesso: manualSuccess, item: usedItem, criatura: captures[0] ?? null },
  };
}
