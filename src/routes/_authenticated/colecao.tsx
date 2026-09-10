import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { PawPrint, Sparkles } from "lucide-react";
import { getCombatState, listCollection } from "@/lib/game.functions";
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
  const [filtro, setFiltro] = useState<string>("Todas");

  const { data: state } = useQuery({ queryKey: ["combatState"], queryFn: () => fetchState() });
  const { data, isPending } = useQuery({
    queryKey: ["colecao"],
    queryFn: () => fetchColecao(),
  });

  const criaturas = (data ?? []) as unknown as CreatureRow[];
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
                <CreatureCard key={c.id} creature={c} />
              ))}
            </div>
          )}
        </section>
      </main>
    </>
  );
}
