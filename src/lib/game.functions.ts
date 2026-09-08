import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import {
  CAPTURE_CHANCE,
  MAX_MS,
  NATURES,
  RARITIES,
  RARITY_BASE_WEIGHTS,
  SHINY_CHANCE,
  TICK_MINUTES,
  type Rarity,
} from "./game";

function randInt(max: number) {
  return Math.floor(Math.random() * max);
}

function pickWeighted<T>(items: T[], weight: (item: T) => number): T {
  const total = items.reduce((sum, i) => sum + Math.max(0, weight(i)), 0);
  let roll = Math.random() * total;
  for (const item of items) {
    roll -= Math.max(0, weight(item));
    if (roll <= 0) return item;
  }
  return items[items.length - 1]!;
}

function rollRarity(multiplicador: number): Rarity {
  const weights = RARITIES.map((r) => {
    const base = RARITY_BASE_WEIGHTS[r];
    if (r === "Comum") return { r, w: base / multiplicador };
    if (r === "Incomum") return { r, w: base };
    return { r, w: base * multiplicador };
  });
  return pickWeighted(weights, (x) => x.w).r;
}

export const getGameState = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const [{ data: profile }, { data: regions }, { data: session }] = await Promise.all([
      supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
      supabase.from("regions").select("*").order("nivel_minimo"),
      supabase
        .from("hunting_sessions")
        .select("*, creatures(*, species(*)), regions(*)")
        .eq("user_id", userId)
        .maybeSingle(),
    ]);

    const { count } = await supabase
      .from("creatures")
      .select("id", { count: "exact", head: true })
      .eq("user_id", userId);

    return {
      profile: profile ?? null,
      regions: regions ?? [],
      session: session ?? null,
      totalCriaturas: count ?? 0,
      serverNow: new Date().toISOString(),
      tickMinutes: TICK_MINUTES,
    };
  });

export const createProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { nome_treinador: string }) => ({
    nome_treinador: data.nome_treinador.trim().slice(0, 24),
  }))
  .handler(async ({ data, context }) => {
    if (data.nome_treinador.length < 2) throw new Error("Nome de treinador muito curto.");
    const { error } = await context.supabase
      .from("profiles")
      .upsert({ id: context.userId, nome_treinador: data.nome_treinador });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getStarters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("species")
      .select("*")
      .eq("is_starter", true)
      .order("id");
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const chooseStarter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { species_id: number }) => ({ species_id: Number(data.species_id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Crie seu perfil de treinador primeiro.");
    if (profile.starter_escolhido) throw new Error("Você já escolheu sua criatura inicial.");

    const { data: species, error: sErr } = await supabase
      .from("species")
      .select("*")
      .eq("id", data.species_id)
      .eq("is_starter", true)
      .maybeSingle();
    if (sErr || !species) throw new Error("Criatura inicial inválida.");

    const nature = NATURES[randInt(NATURES.length)]!;
    const { data: creature, error: cErr } = await supabase
      .from("creatures")
      .insert({
        user_id: userId,
        species_id: species.id,
        nivel: 5,
        iv_hp: randInt(32),
        iv_ataque: randInt(32),
        iv_defesa: randInt(32),
        iv_velocidade: randInt(32),
        nature: nature.nome,
        raridade: "Incomum",
        is_shiny: Math.random() < SHINY_CHANCE,
      })
      .select("id")
      .single();
    if (cErr || !creature) throw new Error(cErr?.message ?? "Falha ao criar criatura.");

    const { data: region } = await supabase
      .from("regions")
      .select("id")
      .order("nivel_minimo")
      .limit(1)
      .maybeSingle();
    if (!region) throw new Error("Nenhuma região disponível.");

    const now = new Date().toISOString();
    const { error: hErr } = await supabase.from("hunting_sessions").upsert(
      {
        user_id: userId,
        creature_id: creature.id,
        region_id: region.id,
        iniciado_em: now,
        ultima_coleta_em: now,
      },
      { onConflict: "user_id" },
    );
    if (hErr) throw new Error(hErr.message);

    await supabase.from("profiles").update({ starter_escolhido: true }).eq("id", userId);
    return { ok: true };
  });

export const changeRegion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { region_id: number }) => ({ region_id: Number(data.region_id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("hunting_sessions")
      .update({ region_id: data.region_id, iniciado_em: now, ultima_coleta_em: now })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setActiveCreature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { creature_id: string }) => ({ creature_id: String(data.creature_id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { data: owned } = await supabase
      .from("creatures")
      .select("id")
      .eq("id", data.creature_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!owned) throw new Error("Criatura não encontrada.");
    const { error } = await supabase
      .from("hunting_sessions")
      .update({ creature_id: data.creature_id, ultima_coleta_em: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCollection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await context.supabase
      .from("creatures")
      .select("*, species(*)")
      .eq("user_id", context.userId)
      .order("capturada_em", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });

export const collectHunt = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;

    const { data: session, error: sErr } = await supabase
      .from("hunting_sessions")
      .select("*, regions(*)")
      .eq("user_id", userId)
      .maybeSingle();
    if (sErr) throw new Error(sErr.message);
    if (!session || !session.regions) throw new Error("Nenhuma caça em andamento.");

    const region = session.regions;
    const now = Date.now();
    const elapsed = Math.min(now - new Date(session.ultima_coleta_em).getTime(), MAX_MS);
    const ticks = Math.floor(elapsed / (TICK_MINUTES * 60 * 1000));

    if (ticks <= 0) {
      return { capturadas: [], ticks: 0, minutos: Math.floor(elapsed / 60000) };
    }

    const speciesIds = (region.species_ids ?? []) as number[];
    const { data: speciesPool, error: spErr } = await supabase
      .from("species")
      .select("*")
      .in("id", speciesIds.length ? speciesIds : [-1]);
    if (spErr) throw new Error(spErr.message);
    if (!speciesPool?.length) throw new Error("Região sem espécies configuradas.");

    const mult = Number(region.multiplicador_raridade) || 1;
    const rows: {
      user_id: string;
      species_id: number;
      nivel: number;
      iv_hp: number;
      iv_ataque: number;
      iv_defesa: number;
      iv_velocidade: number;
      nature: string;
      raridade: string;
      is_shiny: boolean;
    }[] = [];

    for (let i = 0; i < ticks; i++) {
      if (Math.random() > CAPTURE_CHANCE) continue;
      const raridade = rollRarity(mult);
      const rarityIndex = RARITIES.indexOf(raridade);
      const especie = pickWeighted(speciesPool, (s) => {
        const base = Number(s.taxa_raridade_base) || 1;
        // tiers raros favorecem espécies com peso base menor
        return rarityIndex >= 3 ? 1 / base : base;
      });
      const span = Math.max(0, region.nivel_maximo - region.nivel_minimo);
      rows.push({
        user_id: userId,
        species_id: especie.id,
        nivel: region.nivel_minimo + randInt(span + 1),
        iv_hp: randInt(32),
        iv_ataque: randInt(32),
        iv_defesa: randInt(32),
        iv_velocidade: randInt(32),
        nature: NATURES[randInt(NATURES.length)]!.nome,
        raridade,
        is_shiny: Math.random() < SHINY_CHANCE,
      });
    }

    const { error: uErr } = await supabase
      .from("hunting_sessions")
      .update({ ultima_coleta_em: new Date(now).toISOString() })
      .eq("user_id", userId);
    if (uErr) throw new Error(uErr.message);

    if (!rows.length) return { capturadas: [], ticks, minutos: Math.floor(elapsed / 60000) };

    const { data: inserted, error: iErr } = await supabase
      .from("creatures")
      .insert(rows)
      .select("*, species(*)");
    if (iErr) throw new Error(iErr.message);

    return {
      capturadas: inserted ?? [],
      ticks,
      minutos: Math.floor(elapsed / 60000),
    };
  });
