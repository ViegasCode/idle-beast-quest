import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { NATURES, SHINY_CHANCE } from "./game";
import {
  CAP_MS,
  INIMIGOS_POR_FASE,
  JANELA_CAPTURA_MS,
  MAX_BATALHAS_POR_RESOLUCAO,
  combatenteDoJogador,
  expNecessaria,
  expPorAbate,
  hashSeed,
  inimigosDaFase,
  mulberry32,
  regenerar,
  simularBatalha,
  sortearRaridade,
  type RegiaoLike,
  type SpeciesLike,
} from "./combat";

function randInt(max: number) {
  return Math.floor(Math.random() * max);
}

type SupabaseCtx = { supabase: any; userId: string };

async function carregarPool(supabase: any, ids: number[]): Promise<SpeciesLike[]> {
  const { data } = await supabase
    .from("species")
    .select("*")
    .in("id", ids.length ? ids : [-1])
    .order("id");
  return (data ?? []) as SpeciesLike[];
}

function novaCriatura(userId: string, species_id: number, nivel: number, raridade: string) {
  return {
    user_id: userId,
    species_id,
    nivel,
    iv_hp: randInt(32),
    iv_ataque: randInt(32),
    iv_defesa: randInt(32),
    iv_velocidade: randInt(32),
    nature: NATURES[randInt(NATURES.length)]!.nome,
    raridade,
    is_shiny: Math.random() < SHINY_CHANCE,
  };
}

/* ---------------------- Resolução do combate ---------------------- */

async function resolver({ supabase, userId }: SupabaseCtx) {
  const [{ data: profile }, { data: regions }, { data: itens }] = await Promise.all([
    supabase.from("profiles").select("*").eq("id", userId).maybeSingle(),
    supabase.from("regions").select("*").order("nivel_minimo"),
    supabase.from("capture_items").select("*").order("tier"),
  ]);

  const { data: session } = await supabase
    .from("hunting_sessions")
    .select("*, creatures(*, species(*)), regions(*)")
    .eq("user_id", userId)
    .maybeSingle();

  const { data: inventarioRaw } = await supabase
    .from("user_items")
    .select("*")
    .eq("user_id", userId);

  const catalogo = (itens ?? []) as {
    id: number;
    nome: string;
    tier: number;
    taxa_sucesso: number;
    chance_drop: number;
    cor: string;
  }[];

  const inventario = new Map<number, number>();
  for (const row of inventarioRaw ?? []) inventario.set(row.item_id, row.quantidade);

  const base = {
    profile: profile ?? null,
    regions: regions ?? [],
    catalogo,
    serverNow: new Date().toISOString(),
  };

  if (!session || !session.regions || !session.creatures) {
    return {
      ...base,
      session: null,
      criatura: null,
      combatente: null,
      inimigos: [],
      inventario: [...inventario].map(([item_id, quantidade]) => ({ item_id, quantidade })),
      pending: null,
      resumo: null,
      totalCriaturas: 0,
    };
  }

  const region = session.regions as RegiaoLike & { nome: string; descricao: string | null };
  const pool = await carregarPool(supabase, (region.species_ids ?? []) as number[]);
  const criatura = session.creatures;
  const jogador = combatenteDoJogador(criatura);

  const agora = Date.now();
  const desde = new Date(session.ultima_resolucao_em ?? session.ultima_coleta_em).getTime();
  const decorridoBruto = Math.max(0, agora - desde);
  const tempoPerdidoMs = Math.max(0, decorridoBruto - CAP_MS);
  let budget = Math.min(decorridoBruto, CAP_MS);

  const rng = mulberry32(hashSeed(agora & 0x7fffffff, hashSeed(...[...userId].map((c) => c.charCodeAt(0)))));

  let fase = session.fase ?? 1;
  let faseKills = session.fase_kills ?? 0;
  let hp = jogador.hpMax;
  let batalhas = 0;
  let kills = 0;
  let derrotas = 0;
  let expGanha = 0;
  let pressao = Number(session.pressao) || 0;
  const dropsGanhos = new Map<number, number>();
  const novasCriaturas: ReturnType<typeof novaCriatura>[] = [];
  let perdidasSemItem = 0;
  let capturasFalhadas = 0;
  let pending: { species_id: number; nivel: number; expira_em: string } | null = null;

  const mult = Number(region.multiplicador_raridade) || 1;
  const fasesTotal = Math.max(1, region.fases ?? 8);

  if (pool.length) {
    while (budget > 0 && batalhas < MAX_BATALHAS_POR_RESOLUCAO) {
      const fila = inimigosDaFase(region, fase, pool);
      const inimigo = fila[faseKills % INIMIGOS_POR_FASE]!;
      const res = simularBatalha(jogador, inimigo.combatente, rng, hp);
      if (res.duracaoMs > budget) break;
      budget -= res.duracaoMs;
      batalhas++;
      pressao = Math.min(1, res.danoRecebido / jogador.hpMax);

      if (!res.vitoria) {
        derrotas++;
        hp = jogador.hpMax;
        continue;
      }

      kills++;
      expGanha += expPorAbate(inimigo.nivel);
      hp = regenerar(res.hpJogadorFinal, jogador.hpMax);

      for (const item of catalogo) {
        if (rng() < Number(item.chance_drop)) {
          dropsGanhos.set(item.id, (dropsGanhos.get(item.id) ?? 0) + 1);
          inventario.set(item.id, (inventario.get(item.id) ?? 0) + 1);
        }
      }

      if (inimigo.is_capturavel) {
        const disponiveis = catalogo
          .filter((i) => (inventario.get(i.id) ?? 0) > 0)
          .sort((a, b) => Number(b.taxa_sucesso) - Number(a.taxa_sucesso));
        const dentroDaJanela = budget <= JANELA_CAPTURA_MS;
        const melhor = disponiveis[0];

        if (profile?.auto_captura && melhor) {
          inventario.set(melhor.id, (inventario.get(melhor.id) ?? 0) - 1);
          if (rng() < Number(melhor.taxa_sucesso)) {
            novasCriaturas.push(
              novaCriatura(userId, inimigo.species_id, inimigo.nivel, sortearRaridade(mult, rng)),
            );
          } else {
            capturasFalhadas++;
          }
        } else if (dentroDaJanela) {
          pending = {
            species_id: inimigo.species_id,
            nivel: inimigo.nivel,
            expira_em: new Date(agora - budget + JANELA_CAPTURA_MS).toISOString(),
          };
        } else if (!melhor) {
          perdidasSemItem++;
        }
      }

      faseKills++;
      if (faseKills >= INIMIGOS_POR_FASE) {
        faseKills = 0;
        fase = fase >= fasesTotal ? 1 : fase + 1;
      }
    }
  }

  /* ---- persistência ---- */

  const pendingAtual =
    pending ??
    (session.pending_species_id &&
    session.pending_expira_em &&
    new Date(session.pending_expira_em).getTime() > agora
      ? {
          species_id: session.pending_species_id,
          nivel: session.pending_nivel ?? 1,
          expira_em: session.pending_expira_em,
        }
      : null);

  const killsTotal = (session.kills_total ?? 0) + kills;
  const expTotal = Number(session.exp_total ?? 0) + expGanha;

  await supabase
    .from("hunting_sessions")
    .update({
      fase,
      fase_kills: faseKills,
      kills_total: killsTotal,
      exp_total: expTotal,
      pressao,
      ultima_resolucao_em: new Date(agora - budget).toISOString(),
      pending_species_id: pendingAtual?.species_id ?? null,
      pending_nivel: pendingAtual?.nivel ?? null,
      pending_expira_em: pendingAtual?.expira_em ?? null,
    })
    .eq("user_id", userId);

  if (expGanha > 0) {
    let nivel = criatura.nivel as number;
    let exp = (criatura.exp ?? 0) + expGanha;
    while (nivel < 100 && exp >= expNecessaria(nivel)) {
      exp -= expNecessaria(nivel);
      nivel++;
    }
    await supabase.from("creatures").update({ nivel, exp }).eq("id", criatura.id);
    criatura.nivel = nivel;
    criatura.exp = exp;
  }

  if (dropsGanhos.size || novasCriaturas.length || capturasFalhadas) {
    const upserts = [...inventario].map(([item_id, quantidade]) => ({
      user_id: userId,
      item_id,
      quantidade: Math.max(0, quantidade),
    }));
    if (upserts.length) await supabase.from("user_items").upsert(upserts, { onConflict: "user_id,item_id" });
  }

  let capturadas: any[] = [];
  if (novasCriaturas.length) {
    const { data } = await supabase.from("creatures").insert(novasCriaturas).select("*, species(*)");
    capturadas = data ?? [];
  }

  const { count } = await supabase
    .from("creatures")
    .select("id", { count: "exact", head: true })
    .eq("user_id", userId);

  let pendingSpecies: SpeciesLike | null = null;
  if (pendingAtual) {
    pendingSpecies = pool.find((s) => s.id === pendingAtual.species_id) ?? null;
    if (!pendingSpecies) {
      const { data } = await supabase
        .from("species")
        .select("*")
        .eq("id", pendingAtual.species_id)
        .maybeSingle();
      pendingSpecies = data ?? null;
    }
  }

  return {
    ...base,
    session: {
      ...session,
      fase,
      fase_kills: faseKills,
      kills_total: killsTotal,
      exp_total: expTotal,
      pressao,
    },
    criatura,
    combatente: jogador,
    inimigos: pool.length ? inimigosDaFase(region, fase, pool) : [],
    inventario: catalogo.map((i) => ({ item_id: i.id, quantidade: inventario.get(i.id) ?? 0 })),
    pending: pendingAtual ? { ...pendingAtual, species: pendingSpecies } : null,
    resumo: {
      batalhas,
      kills,
      derrotas,
      exp: expGanha,
      segundos: Math.floor(Math.min(decorridoBruto, CAP_MS) / 1000),
      tempoPerdidoMs,
      itens: [...dropsGanhos].map(([item_id, qtd]) => ({
        item_id,
        nome: catalogo.find((i) => i.id === item_id)?.nome ?? "Item",
        qtd,
      })),
      capturadas,
      capturasFalhadas,
      perdidasSemItem,
    },
    totalCriaturas: count ?? 0,
  };
}

export const getCombatState = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => resolver(context as SupabaseCtx));

/* ---------------------- Captura manual ---------------------- */

export const tentarCaptura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { item_id?: number } | undefined) => ({
    item_id: data?.item_id ? Number(data.item_id) : null,
  }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as SupabaseCtx;

    const { data: session } = await supabase
      .from("hunting_sessions")
      .select("*, regions(multiplicador_raridade)")
      .eq("user_id", userId)
      .maybeSingle();
    if (!session?.pending_species_id || !session.pending_expira_em) {
      throw new Error("Nenhuma criatura disponível para captura.");
    }
    if (new Date(session.pending_expira_em).getTime() <= Date.now()) {
      throw new Error("A criatura fugiu antes da tentativa.");
    }

    const { data: catalogo } = await supabase.from("capture_items").select("*").order("tier");
    const { data: inv } = await supabase.from("user_items").select("*").eq("user_id", userId);
    const qtd = new Map<number, number>();
    for (const row of inv ?? []) qtd.set(row.item_id, row.quantidade);

    const disponiveis = (catalogo ?? [])
      .filter((i: any) => (qtd.get(i.id) ?? 0) > 0)
      .sort((a: any, b: any) => Number(b.taxa_sucesso) - Number(a.taxa_sucesso));
    const item = data.item_id
      ? disponiveis.find((i: any) => i.id === data.item_id)
      : disponiveis[0];
    if (!item) throw new Error("Você não tem itens de captura disponíveis.");

    await supabase
      .from("user_items")
      .update({ quantidade: Math.max(0, (qtd.get(item.id) ?? 0) - 1) })
      .eq("user_id", userId)
      .eq("item_id", item.id);

    const sucesso = Math.random() < Number(item.taxa_sucesso);
    let criatura: any = null;
    if (sucesso) {
      const mult = Number(session.regions?.multiplicador_raridade) || 1;
      const { data: inserida } = await supabase
        .from("creatures")
        .insert(
          novaCriatura(
            userId,
            session.pending_species_id,
            session.pending_nivel ?? 1,
            sortearRaridade(mult, Math.random),
          ),
        )
        .select("*, species(*)")
        .single();
      criatura = inserida;
    }

    await supabase
      .from("hunting_sessions")
      .update({ pending_species_id: null, pending_nivel: null, pending_expira_em: null })
      .eq("user_id", userId);

    return { sucesso, item: item.nome, criatura };
  });

export const setAutoCaptura = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { ativo: boolean }) => ({ ativo: Boolean(data.ativo) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const { error } = await supabase
      .from("profiles")
      .update({ auto_captura: data.ativo })
      .eq("id", userId);
    if (error) throw new Error(error.message);
    return { ok: true, ativo: data.ativo };
  });

export const coletarResumo = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const { error } = await supabase
      .from("hunting_sessions")
      .update({ kills_total: 0, exp_total: 0, ultima_coleta_em: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

/* ---------------------- Perfil / starter / regiões ---------------------- */

export const createProfile = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { nome_treinador: string }) => ({
    nome_treinador: data.nome_treinador.trim().slice(0, 24),
  }))
  .handler(async ({ data, context }) => {
    if (data.nome_treinador.length < 2) throw new Error("Nome de treinador muito curto.");
    const { supabase, userId } = context as SupabaseCtx;
    const { error } = await supabase
      .from("profiles")
      .upsert({ id: userId, nome_treinador: data.nome_treinador });
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const getStarters = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { data, error } = await (context as SupabaseCtx).supabase
      .from("species")
      .select("*")
      .eq("is_starter", true)
      .order("id");
    if (error) throw new Error(error.message);
    return (data ?? []) as SpeciesLike[];
  });

export const chooseStarter = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { species_id: number }) => ({ species_id: Number(data.species_id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as SupabaseCtx;

    const { data: profile } = await supabase
      .from("profiles")
      .select("*")
      .eq("id", userId)
      .maybeSingle();
    if (!profile) throw new Error("Crie seu perfil de treinador primeiro.");
    if (profile.starter_escolhido) throw new Error("Você já escolheu sua criatura inicial.");

    const { data: species } = await supabase
      .from("species")
      .select("*")
      .eq("id", data.species_id)
      .eq("is_starter", true)
      .maybeSingle();
    if (!species) throw new Error("Criatura inicial inválida.");

    const { data: creature, error: cErr } = await supabase
      .from("creatures")
      .insert({ ...novaCriatura(userId, species.id, 5, "Incomum"), nivel: 5 })
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
        ultima_resolucao_em: now,
        fase: 1,
        fase_kills: 0,
        kills_total: 0,
        exp_total: 0,
      },
      { onConflict: "user_id" },
    );
    if (hErr) throw new Error(hErr.message);

    // kit inicial de captura
    await supabase
      .from("user_items")
      .upsert([{ user_id: userId, item_id: 1, quantidade: 5 }], { onConflict: "user_id,item_id" });

    await supabase.from("profiles").update({ starter_escolhido: true }).eq("id", userId);
    return { ok: true };
  });

export const changeRegion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { region_id: number }) => ({ region_id: Number(data.region_id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const now = new Date().toISOString();
    const { error } = await supabase
      .from("hunting_sessions")
      .update({
        region_id: data.region_id,
        ultima_resolucao_em: now,
        fase: 1,
        fase_kills: 0,
        pending_species_id: null,
        pending_nivel: null,
        pending_expira_em: null,
      })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const setActiveCreature = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data: { creature_id: string }) => ({ creature_id: String(data.creature_id) }))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const { data: owned } = await supabase
      .from("creatures")
      .select("id")
      .eq("id", data.creature_id)
      .eq("user_id", userId)
      .maybeSingle();
    if (!owned) throw new Error("Criatura não encontrada.");
    const { error } = await supabase
      .from("hunting_sessions")
      .update({ creature_id: data.creature_id, ultima_resolucao_em: new Date().toISOString() })
      .eq("user_id", userId);
    if (error) throw new Error(error.message);
    return { ok: true };
  });

export const listCollection = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context as SupabaseCtx;
    const { data, error } = await supabase
      .from("creatures")
      .select("*, species(*)")
      .eq("user_id", userId)
      .order("capturada_em", { ascending: false });
    if (error) throw new Error(error.message);
    return data ?? [];
  });
