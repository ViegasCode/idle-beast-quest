import { createFileRoute, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
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
  component: Landing,
});

function Landing() {
  const [logado, setLogado] = useState(false);

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setLogado(!!data.user));
  }, []);

  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col items-center justify-center px-5 py-16 text-center">
      <span className="rounded-full border border-border bg-surface/70 px-3 py-1 text-xs font-semibold uppercase tracking-widest text-primary">
        MVP · Caça idle
      </span>
      <h1 className="mt-6 text-4xl font-extrabold sm:text-6xl">
        Sua criatura caça <span className="text-gradient">enquanto você vive</span>
      </h1>
      <p className="mt-5 max-w-xl text-base text-muted-foreground sm:text-lg">
        Escolha seu inicial, envie-o para uma região selvagem e volte para coletar tudo o que ele
        capturou — até 12 horas de progresso acumulado, com a aba fechada.
      </p>

      <div className="mt-9 flex flex-wrap justify-center gap-3">
        <Link
          to={logado ? "/cacando" : "/auth"}
          className="rounded-xl bg-primary px-6 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110"
        >
          {logado ? "Continuar caçada" : "Criar conta e começar"}
        </Link>
        <Link
          to="/auth"
          className="rounded-xl border border-border bg-surface/70 px-6 py-3 text-sm font-semibold transition hover:bg-surface-2"
        >
          Já tenho conta
        </Link>
      </div>

      <div className="mt-14 grid w-full gap-4 sm:grid-cols-3">
        {[
          { t: "Progresso offline", d: "Cálculo feito no servidor a cada coleta, nunca no navegador." },
          { t: "IVs e natures", d: "Cada criatura é única: IVs de 0 a 31 e uma entre 10 natures." },
          { t: "Raridade e shiny", d: "De Comum a Mítico, com chance de shiny de 1 em 500." },
        ].map((f) => (
          <div key={f.t} className="panel p-5 text-left">
            <h2 className="text-sm font-bold text-primary">{f.t}</h2>
            <p className="mt-1 text-sm text-muted-foreground">{f.d}</p>
          </div>
        ))}
      </div>
    </main>
  );
}
