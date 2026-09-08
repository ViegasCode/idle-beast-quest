import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable/index";
import { toast } from "sonner";

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
      navigate({ to: "/cacando" });
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
    navigate({ to: "/cacando" });
  }

  return (
    <main className="flex min-h-screen items-center justify-center px-5 py-12">
      <div className="panel w-full max-w-md p-7">
        <Link to="/" className="text-xs font-semibold text-primary">
          ← Achnuba
        </Link>
        <h1 className="mt-3 text-2xl font-extrabold">
          {modo === "signup" ? "Criar conta de treinador" : "Bem-vindo de volta"}
        </h1>
        <p className="mt-1 text-sm text-muted-foreground">
          Sua caçada continua mesmo com o jogo fechado.
        </p>

        <form onSubmit={enviar} className="mt-6 space-y-3">
          <input
            type="email"
            required
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="seu@email.com"
            className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <input
            type="password"
            required
            minLength={6}
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            placeholder="Senha (mín. 6 caracteres)"
            className="w-full rounded-xl border border-input bg-background/60 px-4 py-3 text-sm outline-none focus:border-primary"
          />
          <button
            type="submit"
            disabled={carregando}
            className="w-full rounded-xl bg-primary px-4 py-3 text-sm font-bold text-primary-foreground transition hover:brightness-110 disabled:opacity-60"
          >
            {carregando ? "Aguarde..." : modo === "signup" ? "Criar conta" : "Entrar"}
          </button>
        </form>

        <button
          onClick={google}
          className="mt-3 w-full rounded-xl border border-border bg-surface-2 px-4 py-3 text-sm font-semibold transition hover:brightness-110"
        >
          Continuar com Google
        </button>

        <button
          onClick={() => setModo(modo === "signup" ? "login" : "signup")}
          className="mt-5 w-full text-xs text-muted-foreground underline"
        >
          {modo === "signup" ? "Já tenho conta — entrar" : "Não tenho conta — criar agora"}
        </button>
      </div>
    </main>
  );
}
