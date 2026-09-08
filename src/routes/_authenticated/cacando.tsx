import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { changeRegion, collectHunt, getGameState } from "@/lib/game.functions";
import { CreatureCard, type CreatureRow } from "@/components/CreatureCard";
import { GameNav } from "@/components/GameNav";
import { MAX_HOURS, MAX_MS, TICK_MINUTES, formatDuration, rarityClass } from "@/lib/game";

export const Route = createFileRoute("/_authenticated/cacando")({
  head: () => ({
    meta: [
      { title: "Caçando · Achnuba" },
      { name: "description", content: "Acompanhe a caça da sua criatura ativa e colete as capturas acumuladas." },
      { property: "og:title", content: "Caçando · Achnuba" },
      { property: "og:description", content: "Progresso idle acumulado, até 12 horas por coleta." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Cacando;
});

function Cacando() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getGameState);
  const coletar = useServerFn(collectHunt);
  const trocarRegiao = useServerFn(changeRegion);

  const [agora, setAgora] = useState(() => Date.now());
  const [novas, setNovas] = useState<CreatureRow[]>([]);

  const { data: state, isPending } = useQuery({
    queryKey: ["gameState"],
    queryFn: () => fetchState(),
    refetchInterval: 60_000,
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

  const coletaMutation = useMutation({
    mutationFn: () => coletar(),
    onSuccess: async (res) => {
      const capturadas = (res.capturadas ?? []) as unknown as CreatureRow[];
      setNovas(capturadas);
      await queryClient.invalidateQueries();
      if (capturadas.length === 0) {
        toast.info(
          res.ticks === 0
            ? `Ainda sem ciclos completos. Cada captura é sorteada a cada ${TICK_MINUTES} min.`
            : "Sua criatura voltou de mãos vazias desta vez.",
        );
      } else {
        toast.success(`${capturadas.length} nova(s) criatura(s) capturada(s)!`);
      }
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const regiaoMutation = useMutation({
    mutationFn: (region_id: number) => trocarRegiao({ data: { region_id } }),
    onSuccess: async () => {
      setNovas([]);
      await queryClient.invalidateQueries({ queryKey: ["gameState"] });
      toast.success("Região alterada. A caça reiniciou aqui.");
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const session = state?.session;
  const criaturaAtiva = session?.creatures as unknown as CreatureRow | undefined;
  const regiaoAtual = session?.regions;

  const acumuladoBruto = session ? agora - new Date(session.ultima_coleta_em).getTime() : 0;
  const acumulado = Math.min(Math.max(acumuladoBruto, 0), MAX_MS);
  const ciclos = Math.floor(acumulado / (TICK_MINUTES * 60 * 1000));
  const pct = Math.min(100, (acumulado / MAX_MS) * 100);
  const noLimite = acumuladoBruto >= MAX_MS;

  return (
    <>
      <GameNav treinador={state?.profile?.nome_treinador} total={state?.totalCriaturas} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {isPending || !session ? (
          <p className="text-sm text-muted-foreground">Carregando caçada...</p>
        ) : (
          <>
            <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
              <section className="panel p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-xs font-semibold uppercase tracking-widest text-primary">
                      Caçando em
                    </p>
                    <h1 className="text-2xl font-extrabold">{regiaoAtual?.nome}</h1>
                    <p className="mt-1 text-sm text-muted-foreground">{regiaoAtual?.descricao}</p>
                  </div>
                  <span className="rounded-full border border-border px-3 py-1 text-xs font-semibold">
                    Nv. {regiaoAtual?.nivel_minimo}–{regiaoAtual?.nivel_maximo}
                  </span>
                </div>

                <div className="mt-6">
                  <div className="flex items-end justify-between">
                    <div>
                      <p className="text-xs text-muted-foreground">Tempo acumulado</p>
                      <p className="font-display text-3xl font-extrabold tabular-nums">
                        {formatDuration(acumulado)}
                      </p>
                    </div>
                    <p className="text-right text-xs text-muted-foreground">
                      {ciclos} ciclo{ciclos === 1 ? "" : "s"} de {TICK_MINUTES} min
                      <br />
                      limite de {MAX_HOURS}h
                    </p>
                  </div>
                  <div className="mt-3 h-3 overflow-hidden rounded-full bg-secondary">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-primary to-accent transition-[width] duration-1000"
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                  {noLimite && (
                    <p className="mt-2 text-xs font-semibold text-accent">
                      Limite de {MAX_HOURS}h atingido — colete para não desperdiçar tempo.
                    </p>
                  )}
                </div>

                <button
                  onClick={() => coletaMutation.mutate()}
                  disabled={coletaMutation.isPending}
                  className="mt-6 w-full rounded-xl bg-primary px-5 py-4 text-sm font-extrabold uppercase tracking-wide text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
                >
                  {coletaMutation.isPending ? "Coletando..." : "Coletar capturas"}
                </button>
                <p className="mt-2 text-center text-[11px] text-muted-foreground">
                  O cálculo acontece no servidor, com base no tempo real desde a última coleta.
                </p>
              </section>

              <aside className="space-y-4">
                <div>
                  <h2 className="mb-2 text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Criatura ativa
                  </h2>
                  {criaturaAtiva ? <CreatureCard creature={criaturaAtiva} /> : null}
                </div>

                <div className="panel p-4">
                  <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">
                    Regiões
                  </h2>
                  <div className="mt-3 space-y-2">
                    {(state?.regions ?? []).map((r) => {
                      const ativa = r.id === regiaoAtual?.id;
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
                            Nv. {r.nivel_minimo}–{r.nivel_maximo} · raridade ×
                            {Number(r.multiplicador_raridade)}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                  <p className="mt-3 text-[11px] text-muted-foreground">
                    Trocar de região reinicia o tempo acumulado.
                  </p>
                </div>
              </aside>
            </div>

            {novas.length > 0 && (
              <section className="mt-8">
                <h2 className="text-lg font-extrabold">
                  Última coleta ·{" "}
                  <span className={`rarity-chip rounded-full px-2 py-0.5 text-xs ${rarityClass("Raro")}`}>
                    {novas.length} capturada(s)
                  </span>
                </h2>
                <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {novas.map((c) => (
                    <CreatureCard key={c.id} creature={c} />
                  ))}
                </div>
              </section>
            )}
          </>
        )}
      </main>
    </>
  );
}
