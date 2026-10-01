import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";
// Dynamically load trusted code inside handlers, never expose the service credential to the browser.
export const getCombatState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { runFarmAction } = await import("./farm.server");
    return (await runFarmAction(context.userId)).view;
  });
export const setSelectedPhase = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ fase: z.number().int().min(1) }))
  .handler(async ({ context, data }) => {
    const { runFarmAction } = await import("./farm.server");
    await runFarmAction(context.userId, { type: "phase", phase: data.fase });
    return { ok: true };
  });
export const changeRegion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ region_id: z.number().int().positive() }))
  .handler(async ({ context, data }) => {
    const { runFarmAction } = await import("./farm.server");
    await runFarmAction(context.userId, { type: "region", regionId: data.region_id });
    return { ok: true };
  });
export const saveTeamFormation = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ creature_ids: z.array(z.string().uuid()).min(1).max(3) }))
  .handler(async ({ context, data }) => {
    const { runFarmAction } = await import("./farm.server");
    await runFarmAction(context.userId, { type: "team", ids: data.creature_ids });
    return { ok: true, creature_ids: data.creature_ids };
  });
export const setActiveCreature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ creature_id: z.string().uuid() }))
  .handler(async ({ context, data }) => {
    const { runFarmAction } = await import("./farm.server");
    await runFarmAction(context.userId, { type: "team", ids: [data.creature_id] });
    return { ok: true };
  });
export const setAutoCaptura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ ativo: z.boolean() }))
  .handler(async ({ context, data }) => {
    const { runFarmAction } = await import("./farm.server");
    await runFarmAction(context.userId, { type: "auto", active: data.ativo });
    return { ok: true };
  });
export const tentarCaptura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(
    z.object({ target_id: z.string().min(1), item_id: z.number().int().positive().optional() }),
  )
  .handler(async ({ context, data }) => {
    const { runFarmAction } = await import("./farm.server");
    const result = await runFarmAction(context.userId, {
      type: "capture",
      targetId: data.target_id,
      itemId: data.item_id ?? null,
    });
    if (!result.captureResult) throw new Error("Nenhum alvo.");
    return result.captureResult;
  });
export const coletarResumo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { runFarmAction } = await import("./farm.server");
    await runFarmAction(context.userId, { type: "summary" });
    return { ok: true };
  });
export const restartFarm = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { runFarmAction } = await import("./farm.server");
    await runFarmAction(context.userId, { type: "restart" });
    return { ok: true };
  });
export const createProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ nome_treinador: z.string().trim().min(2).max(24) }))
  .handler(async ({ context, data }) => {
    const { profile } = await import("./farm.server");
    return profile(context.userId, data.nome_treinador);
  });
export const getStarters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async () => {
    const { starters } = await import("./farm.server");
    return starters();
  });
export const chooseStarter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .validator(z.object({ species_id: z.number().int().positive() }))
  .handler(async ({ context, data }) => {
    const { choose } = await import("./farm.server");
    return choose(context.userId, data.species_id);
  });
export const listCollection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { collection } = await import("./farm.server");
    return collection(context.userId);
  });
