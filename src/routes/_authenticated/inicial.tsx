import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { useEffect, useState } from "react";
import { PawPrint, Shield } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { chooseStarter, createProfile, getCombatState, getStarters } from "@/lib/game.functions";

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
  const fetchState = useServerFn(getCombatState);
  const fetchStarters = useServerFn(getStarters);
  const salvarPerfil = useServerFn(createProfile);
  const escolher = useServerFn(chooseStarter);

  const [nome, setNome] = useState("");
  const [perfilCarregado, setPerfilCarregado] = useState(false);
  const [perfilLocal, setPerfilLocal] = useState<any>(null);

  useEffect(() => {
    let ativo = true;

    async function carregarPerfil() {
      const { data: sessionData } = await supabase.auth.getUser();
      const user = sessionData?.user;
      if (!user) {
        if (ativo) setPerfilCarregado(true);
        return;
      }

      const { data: perfil } = await supabase.from("profiles").select("*").eq("id", user.id).maybeSingle();
      if (!ativo) return;
      setPerfilLocal(perfil ?? null);
      setPerfilCarregado(true);

      if (perfil?.starter_escolhido) {
        navigate({ to: "/cacando", replace: true });
      }
    }

    carregarPerfil();
    return () => {
      ativo = false;
    };
  }, [navigate]);

  const { data: state } = useQuery({
    queryKey: ["combatState"],
    queryFn: () => fetchState(),
    enabled: !!perfilLocal || perfilCarregado,
  });
  const { data: starters } = useQuery({ queryKey: ["starters"], queryFn: () => fetchStarters() });

  useEffect(() => {
    if (state?.profile?.starter_escolhido) navigate({ to: "/cacando", replace: true });
  }, [state, navigate]);

  const perfilMutation = useMutation({
    mutationFn: (nome_treinador: string) => salvarPerfil({ data: { nome_treinador } }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ["combatState"] }),
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

  const temPerfil = !!(perfilLocal ?? state?.profile);

  return (
    <main className="pixel-screen">
      {!temPerfil ? (
        <div className="pixel-frame w-full max-w-md">
          <div className="panel-heading">
            <span><Shield /> Registro</span>
            <span className="text-[9px] uppercase text-muted-foreground">Passo 1/2</span>
          </div>
          <div className="pixel-body">
            <h1 className="pixel-title">Nome de treinador</h1>
            <p className="pixel-sub">Ele aparece no seu perfil de caçador.</p>
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
                className="pixel-input"
              />
              <button disabled={perfilMutation.isPending} className="pixel-button">
                Continuar
              </button>
            </form>
          </div>
        </div>
      ) : (
        <div className="pixel-frame w-full max-w-4xl">
          <div className="panel-heading">
            <span><PawPrint /> Escolha inicial</span>
            <span className="text-[9px] uppercase text-muted-foreground">Passo 2/2</span>
          </div>
          <div className="pixel-body">
            <h1 className="pixel-title text-center">Escolha sua criatura inicial</h1>
            <p className="pixel-sub text-center">
              Ela será sua primeira caçadora. IVs e nature são sorteados na hora.
            </p>

            <div className="starter-grid mt-6">
              {(starters ?? []).map((s) => (
                <button
                  key={s.id}
                  onClick={() => starterMutation.mutate(s.id)}
                  disabled={starterMutation.isPending}
                  className="starter-card"
                >
                  <div className="starter-portrait">
                    {s.sprite_url ? <img src={s.sprite_url} alt={s.nome} /> : null}
                  </div>
                  <h2>{s.nome}</h2>
                  <p className="text-[10px] text-muted-foreground">
                    {s.tipo_primario}
                    {s.tipo_secundario ? ` / ${s.tipo_secundario}` : ""}
                  </p>
                  <dl>
                    <div>
                      <dt>HP base</dt>
                      <dd>{s.hp_base}</dd>
                    </div>
                    <div>
                      <dt>Ataque</dt>
                      <dd>{s.ataque_base}</dd>
                    </div>
                    <div>
                      <dt>Defesa</dt>
                      <dd>{s.defesa_base}</dd>
                    </div>
                    <div>
                      <dt>Velocidade</dt>
                      <dd>{s.velocidade_base}</dd>
                    </div>
                  </dl>
                  <span className="pixel-button mt-1 !h-9 !text-[10px]">Escolher</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </main>
  );
}
