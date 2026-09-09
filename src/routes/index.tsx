import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Achnuba — MMORPG idle de captura de criaturas" },
      {
        name: "description",
        content:
          "Envie sua criatura para caçar em regiões selvagens e colete capturas mesmo com o jogo fechado. Até 12 horas de progresso offline.",
      },
      { property: "og:title", content: "Achnuba — MMORPG idle de captura de criaturas" },
      {
        property: "og:description",
        content:
          "Escolha seu inicial, cace offline e monte uma coleção de criaturas raras, épicas e míticas.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: GameEntry,
});

function GameEntry() {
  const navigate = useNavigate();

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => navigate({ to: data.user ? "/cacando" : "/auth", replace: true }));
  }, [navigate]);

  return (
    <main className="grid min-h-screen place-items-center bg-background">
      <div className="text-center"><Shield className="mx-auto size-10 animate-pulse text-primary" /><h1 className="mt-3 font-display text-2xl">Achnuba</h1><p className="text-sm text-muted-foreground">Abrindo sua jornada...</p></div>
    </main>
  );
}
