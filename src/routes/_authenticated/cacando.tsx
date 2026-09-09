import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  changeRegion,
  coletarResumo,
  getCombatState,
  setAutoCaptura,
  tentarCaptura,
  listCollection,
  setActiveCreature,
  setSelectedPhase,
  setRepeatPhase,
} from "@/lib/game.functions";
import { CreatureCard, type CreatureRow } from "@/components/CreatureCard";
import { CombatArena } from "@/components/CombatArena";
import { GameNav } from "@/components/GameNav";
import { formatDuration, rarityClass } from "@/lib/game";
import { CAP_HORAS, INIMIGOS_POR_FASE, type Combatente, type Inimigo } from "@/lib/combat";
import { BOSS_KEY_ITEM_ID, getBossPhaseNumber } from "@/lib/progression";

export const Route = createFileRoute("/_authenticated/cacando")({
  head: () => ({
    meta: [
      { title: "Combate · Achnuba" },
      {
        name: "description",
        content:
          "Combate PvE idle automático: sua criatura enfrenta inimigos por fases, ganha exp, itens de captura e novas criaturas.",
      },
      { property: "og:title", content: "Combate · Achnuba" },
      {
        property: "og:description",
        content: "Auto-batalhas visíveis por fases, com progresso offline de até 12 horas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Combate,
});

function Combate() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const resolver = useServerFn(getCombatState);
  const capturar = useServerFn(tentarCaptura);
  const alternarAuto = useServerFn(setAutoCaptura);
  const coletar = useServerFn(coletarResumo);
  const trocarRegiao = useServerFn(changeRegion);
  const setPhaseFn = useServerFn(setSelectedPhase);
  const repeatPhaseFn = useServerFn(setRepeatPhase);

  const [agora, setAgora] = useState(() => Date.now());
  const [resumoOffline, setResumoOffline] = useState<any>(null);
  const [mostrouResumo, setMostrouResumo] = useState(false);

  const { data: state, isPending } = useQuery({
    queryKey: ["combatState"],
    queryFn: () => resolver(),
    refetchInterval: 20_000,
  });

  useEffect(() => {
    const t = setInterval(() => setAgora(Date.now()), 1000);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    if (!isPending && state && (!state.profile || !state.profile.starter_escolhido)) {
      navigate({ to: "/inicial", replace: true });
    }
  }, [state, isPending, navigate]);

  useEffect(() => {
    if (mostrouResumo || !state?.resumo) return;
    if (state.resumo.segundos > 180 && state.resumo.batalhas > 0) setResumoOffline(state.resumo);
    setMostrouResumo(true);
  }, [state, mostrouResumo]);

  const capturaMutation = useMutation({
    mutationFn: (item_id?: number | undefined) => capturar({ data: { item_id } }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries();
      if (res.sucesso) toast.success(`Capturada com ${res.item}!`);
      else toast.error(`${res.item} usada, mas a criatura escapou.`);
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const autoMutation = useMutation({
    mutationFn: (ativo: boolean) => alternarAuto({ data: { ativo } }),
    onSuccess: async (res) => {
      await queryClient.invalidateQueries({ queryKey: ["combatState"] });
      toast.success(res.ativo ? "Captura automática ativada." : "Captura automática desativada.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const coletaMutation = useMutation({
    mutationFn: () => coletar(),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["combatState"] });
      toast.success("Resumo coletado. Contadores reiniciados.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const selectPhaseMutation = useMutation({
    mutationFn: (fase: number) => setPhaseFn({ data: { fase } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["combatState"] });
      toast.success("Fase selecionada.");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao selecionar fase"),
  });

  const repeatMutation = useMutation({
    mutationFn: (payload: { ativo: boolean; fase?: number | null }) => repeatPhaseFn({ data: payload }),
    onSuccess: async (res: any) => {
      await queryClient.invalidateQueries({ queryKey: ["combatState"] });
      toast.success(res.ativo ? `Repetindo fase ${res.fase}` : "Repetição de fase desativada");
    },
    onError: (e: any) => toast.error(e?.message ?? "Erro ao alternar repetição"),
  });

  const regiaoMutation = useMutation({
    mutationFn: (region_id: number) => trocarRegiao({ data: { region_id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["combatState"] });
      toast.success("Região alterada. Você volta para a Fase 1.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const session = state?.session as any;
  const regiao = session?.regions;
  const criatura = state?.criatura as unknown as CreatureRow | undefined;
  const jogador = state?.combatente as Combatente | undefined;
  const fila = (state?.inimigos ?? []) as Inimigo[];
  const catalogo = state?.catalogo ?? [];
  const inventario = state?.inventario ?? [];
  const pending = state?.pending as any;
  const bossPhaseNumber = getBossPhaseNumber(Number(regiao?.fases ?? 8));
  const hasBossKey = (inventario.find((item: any) => item.item_id === BOSS_KEY_ITEM_ID)?.quantidade ?? 0) > 0;
  const selectablePhases = Array.from({ length: regiao?.fases ?? 8 }, (_, index) => index + 1);
  selectablePhases.push(bossPhaseNumber);

  const desdeColeta = session ? agora - new Date(session.ultima_coleta_em).getTime() : 0;
  const horas = Math.max(desdeColeta / 3_600_000, 1 / 60);
  const killsHora = session ? Math.round((session.kills_total ?? 0) / horas) : 0;
  const pressao = Number(session?.pressao ?? 0);
  const statusCombate =
    pressao >= 0.6 ? "Sob pressão" : pressao >= 0.3 ? "Combate equilibrado" : "Dominando";
  const totalItens = inventario.reduce((s: number, i: any) => s + i.quantidade, 0);
  const restaPending = pending ? new Date(pending.expira_em).getTime() - agora : 0;

  // Time selection (até 3) — persistido em localStorage por enquanto
  const [teamIds, setTeamIds] = useState<string[]>(() => {
    try {
      const v = localStorage.getItem("team");
      return v ? JSON.parse(v) : session?.creature_id ? [session.creature_id] : [];
    } catch {
      return session?.creature_id ? [session.creature_id] : [];
    }
  });
  const [choosing, setChoosing] = useState(false);

  const listar = useServerFn(listCollection);
  const { data: collection } = useQuery({ queryKey: ["collection"], queryFn: () => listar() });

  useEffect(() => {
    // manter líder sincronizado com session.creature_id se não houver time salvo
    if ((!teamIds || teamIds.length === 0) && session?.creature_id) setTeamIds([session.creature_id]);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [session?.creature_id]);

  function toggleSelect(id: string) {
    setTeamIds((prev) => {
      const has = prev.includes(id);
      let next = has ? prev.filter((x) => x !== id) : [...prev, id].slice(0, 3);
      localStorage.setItem("team", JSON.stringify(next));
      return next;
    });
  }

  const saveLeader = useMutation({
    mutationFn: (creature_id: string) => setActiveCreature({ data: { creature_id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["combatState"] });
      toast.success("Líder do time atualizado.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  return (
    <>
      <GameNav treinador={state?.profile?.nome_treinador} total={state?.totalCriaturas} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {isPending || !session || !jogador ? (
          <p className="text-sm text-muted-foreground">Entrando em combate...</p>
        ) : (
          <>
            <section className="panel grid grid-cols-2 gap-3 p-4 sm:grid-cols-4">
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Abates/hora</p>
                <p className="font-display text-xl font-extrabold tabular-nums">{killsHora}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Status</p>
                <p
                  className={`text-sm font-bold ${
                    pressao >= 0.6 ? "text-destructive" : pressao >= 0.3 ? "text-accent" : "text-primary"
                  }`}
                >
                  {statusCombate}
                </p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">
                  Desde a última coleta
                </p>
                <p className="text-sm font-bold tabular-nums">{formatDuration(desdeColeta)}</p>
              </div>
              <div>
                <p className="text-[10px] uppercase tracking-widest text-muted-foreground">Ganhos</p>
                <p className="text-sm font-bold tabular-nums">
                  +{Number(session.exp_total ?? 0).toLocaleString("pt-BR")} exp ·{" "}
                  {session.kills_total ?? 0} kills
                </p>
              </div>
            </section>

            <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="panel p-5">
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                      {regiao?.nome}
                    </p>
                    <h1 className="text-2xl font-extrabold">
                      Fase {session.fase}/{regiao?.fases ?? 8}
                    </h1>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {session.fase_kills}/{INIMIGOS_POR_FASE} inimigos derrotados nesta fase
                    </p>
                  </div>
                  <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold">
                    Nv. {regiao?.nivel_minimo}–{regiao?.nivel_maximo}
                  </span>
                </div>
                <div className="mt-3 h-2 overflow-hidden rounded-full bg-secondary">
                  <div
                    className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width]"
                    style={{ width: `${((session.fase_kills ?? 0) / INIMIGOS_POR_FASE) * 100}%` }}
                  />
                </div>

                <div className="mt-4">
                  <p className="text-xs font-bold text-muted-foreground">Seleção de Fase</p>
                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    {selectablePhases.map((num) => {
                      const selected = session.fase === num;
                      const isBoss = num === bossPhaseNumber;
                      const disabled = isBoss && !hasBossKey;
                      return (
                        <button
                          key={num}
                          onClick={() => {
                            if (disabled) return;
                            selectPhaseMutation.mutate(num);
                          }}
                          disabled={disabled}
                          className={`rounded-xl px-3 py-2 text-xs font-bold transition ${
                            selected ? 'bg-primary text-primary-foreground' : 'border border-border bg-surface-2/60'
                          } ${isBoss ? 'ring-1 ring-amber-400/80' : ''} ${disabled ? 'cursor-not-allowed opacity-45' : ''}`}
                        >
                          {isBoss ? `Boss ${num}` : `F${num}`}
                        </button>
                      );
                    })}
                  </div>

                  <div className="mt-3 flex items-center gap-3">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={Boolean(state?.profile?.repetir_fase)}
                        onChange={(e) => {
                          const ativo = e.target.checked;
                          // when enabling, send the currently selected phase (session.fase)
                          repeatMutation.mutate({ ativo, fase: ativo ? session?.fase ?? 1 : null });
                        }}
                        className="size-4 accent-primary"
                      />
                      <span className="text-sm font-bold">Repetir fase selecionada</span>
                    </label>
                    <span className="text-xs text-muted-foreground">(Selecione uma fase acima e ative para farm em loop)</span>
                  </div>
                </div>

                <div className="mt-5">
                  {
                    // construir representação simples do time a partir da coleção
                  }
                  <CombatArena
                    jogador={jogador}
                    fila={fila}
                    indiceInicial={session.fase_kills ?? 0}
                    regiao={regiao}
                    time={(teamIds || [])
                      .map((id) => (collection ?? []).find((x: any) => x.id === id))
                      .filter(Boolean)
                      .map((c: any) => ({
                        nome: c.species?.nome ?? "Criatura",
                        nivel: c.nivel,
                        tipos: [c.species?.tipo_primario ?? null, c.species?.tipo_secundario ?? null],
                        sprite_url: c.species?.sprite_url ?? null,
                        hpMax: 10,
                        ataque: 1,
                        defesa: 1,
                        velocidade: 1,
                        is_shiny: c.is_shiny,
                      }))}
                  />
                </div>

                {pending && restaPending > 0 && (
                  <div className="mt-5 rounded-2xl border border-accent/60 bg-accent/10 p-4">
                    <p className="text-xs font-bold uppercase tracking-widest text-accent">
                      Criatura capturável
                    </p>
                    <div className="mt-2 flex items-center gap-3">
                      {pending.species?.sprite_url ? (
                        <img src={pending.species.sprite_url} alt={pending.species.nome} className="size-12" />
                      ) : null}
                      <div className="flex-1">
                        <p className="font-bold">
                          {pending.species?.nome ?? "Criatura"} · Nv. {pending.nivel}
                        </p>
                        <p className="text-[11px] text-muted-foreground">
                          Fugindo em {Math.ceil(restaPending / 1000)}s
                        </p>
                      </div>
                      <button
                        onClick={() => capturaMutation.mutate(undefined)}
                        disabled={capturaMutation.isPending || totalItens === 0}
                        className="rounded-xl bg-accent px-4 py-2 text-xs font-extrabold uppercase text-accent-foreground disabled:opacity-50"
                      >
                        {totalItens === 0 ? "Sem itens" : "Capturar"}
                      </button>
                    </div>
                  </div>
                )}

                <button
                  onClick={() => coletaMutation.mutate()}
                  disabled={coletaMutation.isPending}
                  className="mt-5 w-full rounded-xl border border-border px-5 py-3 text-xs font-bold uppercase tracking-wide text-muted-foreground transition hover:text-foreground disabled:opacity-60"
                >
                  Coletar resumo e zerar contadores
                </button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  Todo o combate é calculado no servidor pelo tempo real decorrido — até {CAP_HORAS}h
                  com a aba fechada.
                </p>
              </section>

              <aside className="space-y-4">
                <div className="panel p-4">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Inventário de captura
                  </h2>
                  <div className="mt-3 space-y-2">
                    {catalogo.map((item: any) => {
                      const qtd = inventario.find((i: any) => i.item_id === item.id)?.quantidade ?? 0;
                      return (
                        <div
                          key={item.id}
                          className="flex items-center gap-3 rounded-xl border border-border bg-surface-2/60 px-3 py-2"
                        >
                          <span
                            className="size-4 shrink-0 rounded-full"
                            style={{ background: item.cor }}
                          />
                          <div className="min-w-0 flex-1">
                            <p className="truncate text-xs font-bold">{item.nome}</p>
                            <p className="text-[10px] text-muted-foreground">
                              {Math.round(Number(item.taxa_sucesso) * 100)}% de captura ·{" "}
                              {Math.round(Number(item.chance_drop) * 100)}% de drop
                            </p>
                          </div>
                          <span className="font-display text-lg font-extrabold tabular-nums">{qtd}</span>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="panel p-4">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Configurações
                  </h2>
                  <label className="mt-3 flex cursor-pointer items-start gap-3">
                    <input
                      type="checkbox"
                      checked={Boolean(state?.profile?.auto_captura)}
                      onChange={(e) => autoMutation.mutate(e.target.checked)}
                      className="mt-0.5 size-4 accent-primary"
                    />
                    <span className="text-xs">
                      Usar item de captura automaticamente ao encontrar criatura capturável
                      <span className="mt-1 block text-[10px] text-muted-foreground">
                        Usa o melhor item disponível. Desligado, aparece o botão “Capturar”.
                      </span>
                    </span>
                  </label>
                </div>

                <div>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Time de combate (até 3)
                  </h2>
                  <div className="mb-3 flex gap-2">
                    {teamIds.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma criatura selecionada.</p>}
                    {teamIds.map((id) => {
                      const c = (collection ?? []).find((x: any) => x.id === id) as any;
                      return c ? (
                        <div key={id} className="w-28">
                          <CreatureCard creature={c} />
                        </div>
                      ) : (
                        <div key={id} className="w-28 rounded-xl bg-secondary/40 p-3 text-center">Carregando...</div>
                      );
                    })}
                    {Array.from({ length: Math.max(0, 3 - teamIds.length) }).map((_, i) => (
                      <div key={i} className="w-28 rounded-xl border border-border bg-surface-2/60 p-3 text-center text-xs text-muted-foreground">
                        Vazio
                      </div>
                    ))}
                  </div>

                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => setChoosing((v) => !v)}
                      className="rounded-xl border px-3 py-2 text-xs"
                    >
                      {choosing ? "Fechar seleção" : "Montar/Editar time"}
                    </button>
                    <button
                      onClick={() => {
                        if (teamIds[0]) saveLeader.mutate(teamIds[0]);
                      }}
                      disabled={!teamIds[0] || saveLeader.isLoading}
                      className="rounded-xl bg-primary px-3 py-2 text-xs font-bold text-primary-foreground disabled:opacity-60"
                    >
                      Salvar líder
                    </button>
                  </div>

                  {choosing && (
                    <div className="mt-3 space-y-2 max-h-64 overflow-y-auto">
                      {(collection ?? []).map((c: any) => (
                        <label key={c.id} className="flex items-center gap-3 rounded-xl border px-3 py-2">
                          <input
                            type="checkbox"
                            checked={teamIds.includes(c.id)}
                            onChange={() => toggleSelect(c.id)}
                            className="size-4"
                          />
                          <div className="flex-1">
                            <div className="flex items-center justify-between">
                              <div className="flex items-center gap-2">
                                {c.species?.sprite_url ? (
                                  <img src={c.species.sprite_url} alt={c.species.nome} className="size-8" />
                                ) : null}
                                <div>
                                  <div className="font-bold text-sm">{c.species?.nome}</div>
                                  <div className="text-xs text-muted-foreground">Nv. {c.nivel}</div>
                                </div>
                              </div>
                              <div className="text-sm font-semibold">{c.raridade}</div>
                            </div>
                          </div>
                        </label>
                      ))}
                    </div>
                  )}
                </div>

                <div className="panel p-4">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Regiões
                  </h2>
                  <div className="mt-3 space-y-2">
                    {(state?.regions ?? []).map((r: any) => {
                      const ativa = r.id === regiao?.id;
                      return (
                        <button
                          key={r.id}
                          disabled={ativa || regiaoMutation.isPending}
                          onClick={() => regiaoMutation.mutate(r.id)}
                          className={`w-full rounded-xl border px-3 py-2 text-left text-xs transition ${
                            ativa
                              ? "border-primary bg-primary/15"
                              : "border-border bg-surface-2/60 hover:border-primary/60"
                          }`}
                        >
                          <span className="block font-bold text-foreground">{r.nome}</span>
                          <span className="text-muted-foreground">
                            Nv. {r.nivel_minimo}–{r.nivel_maximo} · {r.fases} fases · raridade ×
                            {Number(r.multiplicador_raridade)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </div>
              </aside>
            </div>

            {resumoOffline && (
              <div className="fixed inset-0 z-40 grid place-items-center bg-background/80 p-4 backdrop-blur">
                <div className="panel max-h-[85vh] w-full max-w-lg overflow-y-auto p-6">
                  <h2 className="font-display text-xl font-extrabold">Enquanto você esteve fora</h2>
                  <p className="mt-1 text-xs text-muted-foreground">
                    {formatDuration(resumoOffline.segundos * 1000)} de combate simulado
                    {resumoOffline.tempoPerdidoMs > 0
                      ? ` · limite de ${CAP_HORAS}h atingido, tempo extra não contou`
                      : ""}
                  </p>
                  <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                    <p>
                      <span className="font-bold">{resumoOffline.batalhas}</span> combates
                    </p>
                    <p>
                      <span className="font-bold">{resumoOffline.kills}</span> abates
                    </p>
                    <p>
                      <span className="font-bold">
                        +{Number(resumoOffline.exp).toLocaleString("pt-BR")}
                      </span>{" "}
                      exp
                    </p>
                    <p>
                      <span className="font-bold">{resumoOffline.derrotas}</span> recuos
                    </p>
                  </div>
                  <div className="mt-4 text-xs text-muted-foreground">
                    <p className="font-bold text-foreground">Itens de captura ganhos</p>
                    {resumoOffline.itens.length ? (
                      <ul className="mt-1 space-y-0.5">
                        {resumoOffline.itens.map((i: any) => (
                          <li key={i.item_id}>
                            +{i.qtd} {i.nome}
                          </li>
                        ))}
                      </ul>
                    ) : (
                      <p className="mt-1">Nenhum item dropou nesse período.</p>
                    )}
                    {resumoOffline.capturasFalhadas > 0 && (
                      <p className="mt-2">
                        {resumoOffline.capturasFalhadas} tentativa(s) de captura falharam.
                      </p>
                    )}
                    {resumoOffline.perdidasSemItem > 0 && (
                      <p className="mt-1 text-destructive">
                        {resumoOffline.perdidasSemItem} criatura(s) capturável(is) perdida(s) por falta
                        de item.
                      </p>
                    )}
                  </div>

                  {resumoOffline.capturadas.length > 0 && (
                    <div className="mt-4">
                      <p className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                        Capturadas automaticamente ·{" "}
                        <span className={`rarity-chip rounded-full px-2 py-0.5 ${rarityClass("Raro")}`}>
                          {resumoOffline.capturadas.length}
                        </span>
                      </p>
                      <div className="mt-3 grid gap-3 sm:grid-cols-2">
                        {resumoOffline.capturadas.map((c: CreatureRow) => (
                          <CreatureCard key={c.id} creature={c} />
                        ))}
                      </div>
                    </div>
                  )}

                  <button
                    onClick={() => setResumoOffline(null)}
                    className="mt-5 w-full rounded-xl bg-primary px-5 py-3 text-sm font-extrabold uppercase text-primary-foreground"
                  >
                    Voltar ao combate
                  </button>
                </div>
              </div>
            )}
          </>
        )}
      </main>
    </>
  );
}
