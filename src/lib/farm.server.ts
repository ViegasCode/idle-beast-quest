import { supabaseAdmin } from "../integrations/supabase/client.server";
import { makeCapture, resolveGame, type Action, type Snapshot, type Item } from "./farm-game";
import { getFaseDef } from "./phases";
import { NATURES } from "./game";
import type { SpeciesLike } from "./combat";
// All callers authenticate first and pass context.userId, never client-supplied identity.
const rpc = async <T>(name: string, args: Record<string, unknown>): Promise<T> => {
  const call = supabaseAdmin.rpc.bind(supabaseAdmin) as unknown as (
    name: string,
    args: Record<string, unknown>,
  ) => Promise<{ data: T; error: { message: string } | null }>;
  const { data, error } = await call(name, args);
  if (error) throw new Error(`Falha ao salvar o combate: ${error.message}`);
  return data;
};
async function snapshot(userId: string) {
  return rpc<Snapshot>("farm_snapshot", { p_user_id: userId });
}
export async function runFarmAction(userId: string, action: Action = { type: "resolve" }) {
  for (let attempt = 0; attempt < 3; attempt++) {
    const s = await snapshot(userId);
    if (!s.profile || !s.session) {
      if (action.type !== "resolve") throw new Error("Escolha sua criatura inicial primeiro.");
      const [regions, items] = await Promise.all([
        supabaseAdmin.from("regions").select("*").order("nivel_minimo"),
        supabaseAdmin.from("capture_items").select("*").order("tier"),
      ]);
      if (regions.error || items.error) throw new Error("Falha ao carregar regiões ou itens.");
      return {
        view: {
          profile: s.profile ?? null,
          session: null,
          regions: regions.data ?? [],
          catalogo: (items.data ?? []) as Item[],
          serverNow: new Date().toISOString(),
          farm: null,
          events: [],
          creatures: [],
          criatura: null,
          combatente: null,
          inventario: [],
          pending: null,
          faseDef: getFaseDef(0, 1, [], 8),
          totalCriaturas: 0,
          resumo: null,
        },
        captureResult: null,
      };
    }
    const result = resolveGame(s, action);
    const committed = await rpc<boolean>("farm_commit", {
      p_user_id: userId,
      p_revision: s.farm.revision,
      p_payload: result.payload,
    });
    if (committed) return result;
  }
  throw new Error("Sua sessão foi atualizada em outra aba. Tente novamente.");
}
export async function profile(userId: string, name: string) {
  const { error } = await supabaseAdmin
    .from("profiles")
    .upsert({ id: userId, nome_treinador: name }, { onConflict: "id" });
  if (error) throw new Error(error.message);
  return { ok: true };
}
export async function starters() {
  const { data, error } = await supabaseAdmin
    .from("species")
    .select("*")
    .eq("is_starter", true)
    .order("id");
  if (error) throw new Error(error.message);
  return data as SpeciesLike[];
}
export async function choose(userId: string, speciesId: number) {
  const random = () => Math.random();
  const creature = makeCapture(speciesId, 5, 1, random);
  creature.nature = creature.nature ?? NATURES[0]!.nome;
  await rpc("farm_choose_starter", {
    p_user_id: userId,
    p_species_id: speciesId,
    p_creature: creature,
  });
  return { ok: true };
}
export async function collection(userId: string) {
  const { data, error } = await supabaseAdmin
    .from("creatures")
    .select("*, species(*)")
    .eq("user_id", userId)
    .order("capturada_em", { ascending: false });
  if (error) throw new Error(error.message);
  return data ?? [];
}
