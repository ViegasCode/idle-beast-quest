import { createFileRoute } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useState } from "react";
import { getCombatState, listCollection } from "@/lib/game.functions";
import { CreatureCard, type CreatureRow } from "@/components/CreatureCard";
import { GameNav } from "@/components/GameNav";
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
  const visiveis =
    filtro === "Todas"
      ? criaturas
      : filtro === "Shiny"
        ? criaturas.filter((c) => c.is_shiny)
        : criaturas.filter((c) => c.raridade === filtro);

  return (
    <>
      <GameNav treinador={state?.profile?.nome_treinador} total={state?.totalCriaturas} />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <h1 className="text-2xl font-extrabold">Coleção</h1>
        <p className="mt-1 text-sm text-muted-foreground">
          {criaturas.length} criatura{criaturas.length === 1 ? "" : "s"} capturada
          {criaturas.length === 1 ? "" : "s"}.
        </p>

        <div className="mt-4 flex flex-wrap gap-2">
          {["Todas", ...RARITIES, "Shiny"].map((f) => (
            <button
              key={f}
              onClick={() => setFiltro(f)}
              className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                filtro === f
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-surface/70 text-muted-foreground hover:text-foreground"
              }`}
            >
              {f}
            </button>
          ))}
        </div>

        {isPending ? (
          <p className="mt-8 text-sm text-muted-foreground">Carregando coleção...</p>
        ) : visiveis.length === 0 ? (
          <div className="panel mt-8 p-8 text-center text-sm text-muted-foreground">
            Nenhuma criatura aqui ainda. Volte para a caçada e colete!
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {visiveis.map((c) => (
              <CreatureCard key={c.id} creature={c} />
            ))}
          </div>
        )}
      </main>
    </>
  );
}
