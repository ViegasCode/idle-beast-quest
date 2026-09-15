import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { Minus, PawPrint, Plus, Save, Shield, Sparkles } from "lucide-react";
import { toast } from "sonner";
import { getCombatState, listCollection, saveTeamFormation } from "@/lib/game.functions";
import { CreatureCard, type CreatureRow } from "@/components/CreatureCard";
import { GameNav } from "@/components/GameNav";
import { Button } from "@/components/ui/button";
import { RARITIES } from "@/lib/game";

export const Route = createFileRoute("/_authenticated/colecao")({
  head: () => ({
    meta: [
      { title: "Coleção · Achnuba" },
      { name: "description", content: "Veja todas as criaturas que você capturou, com nível, raridade, IVs e shiny." },
      { property: "og:title", content: "Coleção · Achnuba" },
      { property: "og:description", content: "Sua coleção completa de criaturas capturadas." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Colecao,
});

function Colecao() {
  const fetchColecao = useServerFn(listCollection);
  const fetchState = useServerFn(getCombatState);
  const saveFormation = useServerFn(saveTeamFormation);
  const queryClient = useQueryClient();
  const [filtro, setFiltro] = useState<string>("Todas");
  const [teamIds, setTeamIds] = useState<string[]>([]);
  const [teamReady, setTeamReady] = useState(false);

  const { data: state } = useQuery({ queryKey: ["combatState"], queryFn: () => fetchState() });
  const { data, isPending } = useQuery({
    queryKey: ["colecao"],
    queryFn: () => fetchColecao(),
  });

  const criaturas = (data ?? []) as unknown as CreatureRow[];
  const persistedIds = Array.isArray(state?.profile?.active_team_ids) && state.profile.active_team_ids.length
    ? state.profile.active_team_ids.slice(0, 3)
    : state?.session?.creature_id
      ? [state.session.creature_id]
      : [];
  useEffect(() => {
    if (teamReady || !state) return;
    setTeamIds(persistedIds);
    setTeamReady(true);
  }, [persistedIds, state, teamReady]);

  const saveMutation = useMutation({
    mutationFn: () => saveFormation({ data: { creature_ids: teamIds } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ["combatState"] });
      toast.success("Formação salva e batalha atualizada.");
    },
    onError: (error: Error) => toast.error(error.message),
  });
  const saved = teamIds.length === persistedIds.length && teamIds.every((id, index) => id === persistedIds[index]);
  const members = teamIds.map((id) => criaturas.find((creature) => creature.id === id)).filter((creature): creature is CreatureRow => Boolean(creature));
  const shinies = criaturas.filter((c) => c.is_shiny).length;
  const visiveis =
    filtro === "Todas"
      ? criaturas
      : filtro === "Shiny"
        ? criaturas.filter((c) => c.is_shiny)
        : criaturas.filter((c) => c.raridade === filtro);

  return (
    <>
      <GameNav treinador={state?.profile?.nome_treinador} total={state?.totalCriaturas} />
      <main className="game-main">
        <section className="pixel-frame">
          <div className="panel-heading">
            <span><PawPrint /> Capturas</span>
            <span className="text-[10px] text-muted-foreground">
              {criaturas.length} criatura{criaturas.length === 1 ? "" : "s"}
            </span>
          </div>

          <div className="pixel-body pb-0">
            <section className="formation-panel" aria-label="Formação atual">
              <div className="formation-heading">
                <div><h1 className="pixel-title">Time da fase</h1><p className="pixel-sub">A primeira criatura será a líder da batalha.</p></div>
                <Button className="formation-save" disabled={teamIds.length === 0 || saved || saveMutation.isPending} onClick={() => saveMutation.mutate()}><Save /> {saveMutation.isPending ? "Salvando" : "Salvar"}</Button>
              </div>
              <div className="formation-grid">
                {Array.from({ length: 3 }, (_, index) => {
                  const creature = members[index];
                  return creature ? (
                    <article className={`formation-slot ${index === 0 ? "is-leader" : ""}`} key={creature.id}>
                      <div className="formation-portrait">{creature.species?.sprite_url ? <img src={creature.species.sprite_url} alt={creature.species.nome} /> : <Shield />}</div>
                      <div><small>{index === 0 ? "LÍDER" : `MEMBRO ${index + 1}`}</small><b>{creature.species?.nome ?? "Criatura"}</b><span>Nv. {creature.nivel} · {creature.raridade}</span></div>
                      <Button variant="ghost" size="icon" aria-label={`Retirar ${creature.species?.nome ?? "criatura"} do time`} title="Retirar do time" onClick={() => setTeamIds((current) => current.filter((id) => id !== creature.id))}><Minus /></Button>
                    </article>
                  ) : (
                    <div className="formation-slot is-empty" key={`empty-${index}`}><Plus /><span>Vaga {index + 1}</span></div>
                  );
                })}
              </div>
            </section>
            <div className="collection-head">
              <div>
                <h1 className="pixel-title">Coleção</h1>
                <p className="pixel-sub">
                  {criaturas.length} capturada{criaturas.length === 1 ? "" : "s"} · {shinies} shiny
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                {["Todas", ...RARITIES, "Shiny"].map((f) => (
                  <Button
                    key={f}
                    type="button"
                    variant="ghost"
                    onClick={() => setFiltro(f)}
                    className={`pixel-chip ${filtro === f ? "is-active" : ""}`}
                  >
                    {f === "Shiny" ? <Sparkles className="size-3" /> : null}
                    {f}
                  </Button>
                ))}
              </div>
            </div>
          </div>

          {isPending ? (
            <div className="pixel-empty">Carregando coleção...</div>
          ) : visiveis.length === 0 ? (
            <div className="pixel-empty px-6 text-center text-sm">
              Nenhuma criatura aqui ainda. Volte para a batalha e capture!
            </div>
          ) : (
            <div className="collection-grid">
              {visiveis.map((c) => (
                <CreatureCard key={c.id} creature={c} action={
                  <Button variant="ghost" size="icon" disabled={teamIds.includes(c.id) || teamIds.length >= 3} aria-label={`Adicionar ${c.species?.nome ?? "criatura"} ao time`} title={teamIds.includes(c.id) ? "Já está no time" : "Adicionar ao time"} onClick={() => setTeamIds((current) => current.includes(c.id) || current.length >= 3 ? current : [...current, c.id])}><Plus /></Button>
                } />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
