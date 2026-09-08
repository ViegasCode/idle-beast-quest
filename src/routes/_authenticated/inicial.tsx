import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { chooseStarter, createProfile, getGameState, getStarters } from "@/lib/game.functions";

export const Route = createFileRoute("/_authenticated/inicial")({
  head: () => ({
    meta: [
      { title: "Escolha seu inicial · Achnuba" },
      { name: "description", content: "Escolha entre três criaturas iniciais e comece sua jornada de caça idle." },
      { property: "og:title", content: "Escolha seu inicial · Achnuba" },
      { property: "og:description", content: "Três iniciais, uma escolha. Comece sua coleção." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: Inicial,
});

function Inicial() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const fetchState = useServerFn(getGameState);
  const fetchStarters = useServerFn(getStarters);
  const salvarPerfil = useServerFn(createProfile);
  const escolher = useServerFn(chooseStarter);

  const [nome, setNome] = useState("");

  const { data: state } = useQuery({ queryKey: ["gameState"], queryFn: () => fetchState() });
  const { data: starters } = useQuery({ queryKey: ["starters"], queryFn: () => fetchStarters() });

  useEffect(() => {
    if (state?.profile?.starter_escolhido) navigate({ to: "/cacando", replace: true });
  }, [state, navigate]);

  const perfilMutation = useMutation({
    mutationFn: (nome_treinador: string) => salvarPerfil({ data: { nome_treinador } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["gameState"] }),
    onError: (e: Error) => toast.error(e.message),
  });

  const starterMutation = useMutation({
    mutationFn: (species_id: number) => escolher({ data: { species_id } }),
    onSuccess: async () => {
      await queryClient.invalidateQueries();
      toast.success("Sua jornada começou! Boa caçada.");
      navigate({ to: "/cacando" });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const temPerfil = !!state?.profile;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10">
      {!temPerfil ? (
        <div className="panel mx-auto max-w-md p-7">
          <h1 className="text-2xl font-extrabold">Qual seu nome de treinador?</h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Ele aparece no seu perfil de caçador.
          </p>
          <form
            className="mt-5 space-y-3"
            onSubmit={(e) => {
              e.preventDefault();
              perfilMutation.mutate(nome);
            }}
          >
            <input
              value={nome}
              onChange={(e) => setNome(e.target.value)}
              required
              minLength={2}
              maxLength={24}
              placeholder="Ex: Kaia do Vale"
              className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm outline-none focus:border-primary"
            />
            <button
              disabled={perfilMutation.isPending}
              className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
            >
              Continuar
            </button>
          </form>
        </div>
      ) : (
        <>
          <h1 className="text-center text-3xl font-extrabold">
            Escolha sua <span className="text-gradient">criatura inicial</span>
          </h1>
          <p className="mt-2 text-center text-sm text-muted-foreground">
            Ela será sua primeira caçadora. IVs e nature são sorteados na hora.
          </p>

          <div className="mt-8 grid gap-4 sm:grid-cols-3">
            {(starters ?? []).map((s) => (
              <button
                key={s.id}
                onClick={() => starterMutation.mutate(s.id)}
                disabled={starterMutation.isPending}
                className="rarity-card rarity-incomum p-5 text-left disabled:opacity-60"
              >
                <div className="grid size-24 place-items-center overflow-hidden rounded-xl bg-secondary/60">
                  {s.sprite_url ? (
                    <img src={s.sprite_url} alt={s.nome} className="size-20" />
                  ) : null}
                </div>
                <h2 className="mt-3 text-lg font-bold">{s.nome}</h2>
                <p className="text-xs text-muted-foreground">
                  {s.tipo_primario}
                  {s.tipo_secundario ? ` / ${s.tipo_secundario}` : ""}
                </p>
                <dl className="mt-3 space-y-1 text-xs text-muted-foreground">
                  <div className="flex justify-between">
                    <dt>HP base</dt>
                    <dd className="font-semibold text-foreground">{s.hp_base}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Ataque</dt>
                    <dd className="font-semibold text-foreground">{s.ataque_base}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Defesa</dt>
                    <dd className="font-semibold text-foreground">{s.defesa_base}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt>Velocidade</dt>
                    <dd className="font-semibold text-foreground">{s.velocidade_base}</dd>
                  </div>
                </dl>
                <span className="mt-4 block rounded-lg bg-primary py-2 text-center text-xs font-bold text-primary-foreground">
                  Escolher {s.nome}
                </span>
              </button>
            ))}
          </div>
        </>
      )}
    </main>
  );
}
