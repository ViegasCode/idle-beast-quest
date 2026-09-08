import { Link, useNavigate } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export function GameNav({ treinador, total }: { treinador?: string; total?: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <header className="sticky top-0 z-20 border-b border-border bg-background/85 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center gap-3 px-4 py-3">
        <Link to="/cacando" className="font-display text-lg font-extrabold text-gradient">
          Achnuba
        </Link>
        <nav className="ml-auto flex items-center gap-1 text-xs font-semibold">
          <Link
            to="/cacando"
            className="rounded-lg px-3 py-2 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground [&.active]:bg-surface-2 [&.active]:text-primary"
          >
            Caçando
          </Link>
          <Link
            to="/colecao"
            className="rounded-lg px-3 py-2 text-muted-foreground transition hover:bg-surface-2 hover:text-foreground [&.active]:bg-surface-2 [&.active]:text-primary"
          >
            Coleção{typeof total === "number" ? ` (${total})` : ""}
          </Link>
          <button
            onClick={sair}
            className="rounded-lg px-3 py-2 text-muted-foreground transition hover:text-destructive"
          >
            Sair
          </button>
        </nav>
      </div>
      {treinador ? (
        <div className="mx-auto max-w-5xl px-4 pb-2 text-[11px] text-muted-foreground">
          Treinador: <span className="font-semibold text-foreground">{treinador}</span>
        </div>
      ) : null}
    </header>
  );
}
