import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { Shield, Swords } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Entrar · Achnuba" },
      { name: "description", content: "Crie sua conta de treinador ou entre para continuar sua caçada idle." },
      { property: "og:title", content: "Entrar · Achnuba" },
      { property: "og:description", content: "Acesse sua conta de treinador em Achnuba." },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const [modo, setModo] = useState<"login" | "signup">("signup");
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [carregando, setCarregando] = useState(false);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    setCarregando(true);
    try {
      if (modo === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password: senha,
          options: { emailRedirectTo: window.location.origin },
        });
        if (error) throw error;
        if (!data.session) {
          toast.info("Confira seu e-mail para confirmar a conta.");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password: senha });
        if (error) throw error;
      }
      navigate({ to: "/inicial" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Não foi possível continuar.");
    } finally {
      setCarregando(false);
    }
  }

  async function google() {
    const result = await lovable.auth.signInWithOAuth("google", {
      redirect_uri: window.location.origin,
    });
    if (result.error) {
      toast.error("Falha ao entrar com Google.");
      return;
    }
    if (result.redirected) return;
    navigate({ to: "/inicial" });
  }

  return (
    <main className="pixel-screen">
      <div className="pixel-frame w-full max-w-md">
        <div className="panel-heading">
          <span><Shield /> Achnuba</span>
          <span className="text-[9px] uppercase text-muted-foreground">Acesso</span>
        </div>

        <div className="pixel-body">
          <div className="mb-4 flex items-center gap-3">
            <div className="grid size-12 place-items-center border-2 border-border bg-surface-2 shadow-[3px_3px_oklch(0_0_0_/_.55)]">
              <Swords className="size-6 text-gold" />
            </div>
            <div>
              <h1 className="pixel-title">
                {modo === "signup" ? "Criar conta" : "Bem-vindo de volta"}
              </h1>
              <p className="pixel-sub">Sua caçada continua mesmo com o jogo fechado.</p>
            </div>
          </div>

          <form onSubmit={enviar} className="space-y-3">
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="seu@email.com"
              className="pixel-input"
            />
            <input
              type="password"
              required
              minLength={6}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              placeholder="Senha (mín. 6 caracteres)"
              className="pixel-input"
            />
            <Button type="submit" disabled={carregando} className="pixel-button">
              {carregando ? "Aguarde..." : modo === "signup" ? "Criar conta" : "Entrar"}
            </Button>
          </form>

          <div className="pixel-divider">ou</div>

          <Button type="button" variant="ghost" onClick={google} className="pixel-button pixel-button-ghost">
            Continuar com Google
          </Button>

          <Button
            type="button"
            variant="link"
            onClick={() => setModo(modo === "signup" ? "login" : "signup")}
            className="pixel-link mt-5 block w-full text-center"
          >
            {modo === "signup" ? "Já tenho conta — entrar" : "Não tenho conta — criar agora"}
          </Button>
        </div>
      </div>
    </main>
  );
}
