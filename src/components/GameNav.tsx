import { Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { useQueryClient } from "@tanstack/react-query";
import {
  Backpack,
  Castle,
  Coins,
  Gem,
  Globe2,
  LogOut,
  Menu,
  PawPrint,
  ScrollText,
  Settings,
  Shield,
  Store,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";

export function GameNav({ treinador, total }: { treinador?: string; total?: number }) {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const pathname = useRouterState({ select: (state) => state.location.pathname });
  const [open, setOpen] = useState(false);

  async function sair() {
    await queryClient.cancelQueries();
    queryClient.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  const navClass = (active: boolean) =>
    `game-nav-item ${active ? "game-nav-item-active" : ""}`;

  return (
    <>
      <header className="game-topbar">
        <Button variant="ghost" size="icon" className="lg:hidden" onClick={() => setOpen((value) => !value)} aria-label="Abrir menu">
          {open ? <X /> : <Menu />}
        </Button>
        <div className="game-wordmark">
          <Shield className="size-5 text-primary" />
          <span>Achnuba</span>
        </div>
        <div className="ml-auto flex min-w-0 items-center gap-2 sm:gap-4">
          <div className="resource-chip hidden sm:flex"><Coins className="text-gold" /><span>{(total ?? 0) * 125}</span></div>
          <div className="resource-chip"><Gem className="text-crystal" /><span>{total ?? 0}</span></div>
          <div className="hidden min-w-0 text-right md:block">
            <p className="truncate text-xs font-bold text-foreground">{treinador ?? "Treinador"}</p>
            <p className="text-[10px] uppercase text-muted-foreground">Colecionador</p>
          </div>
          <Button variant="ghost" size="icon" aria-label="Configurações" title="Configurações"><Settings /></Button>
        </div>
      </header>

      <aside className={`game-sidebar ${open ? "game-sidebar-open" : ""}`}>
        <div className="sidebar-crest"><Shield /><span>A</span></div>
        <nav className="mt-3 grid gap-1.5">
          <Button variant="ghost" className={navClass(false)} onClick={() => toast.info("O mapa do mundo será liberado em uma próxima fase.")}><Globe2 /><span>Mundo</span></Button>
          <Link to="/cacando" className={navClass(pathname === "/cacando")} onClick={() => setOpen(false)}><Swords /><span>Batalha</span></Link>
          <Button variant="ghost" className={navClass(false)} onClick={() => toast.info("A cidade ainda está em construção.")}><Castle /><span>Cidade</span></Button>
          <Button variant="ghost" className={navClass(false)} onClick={() => toast.info("Monte seu time na tela de batalha.")}><Users /><span>Time</span></Button>
          <Link to="/colecao" className={navClass(pathname === "/colecao")} onClick={() => setOpen(false)}><PawPrint /><span>Capturas</span></Link>
          <Button variant="ghost" className={navClass(false)} onClick={() => toast.info("Seus itens aparecem na tela de batalha.")}><Backpack /><span>Bolsa</span></Button>
          <Button variant="ghost" className={navClass(false)} onClick={() => toast.info("A loja ainda não está disponível.")}><Store /><span>Loja</span></Button>
          <Button variant="ghost" className={navClass(false)} onClick={() => toast.info("As missões serão liberadas em breve.")}><ScrollText /><span>Missões</span></Button>
        </nav>
        <div className="mt-auto border-t border-border/70 pt-3">
          <div className="mb-3 flex items-center gap-2 px-2 text-[10px] uppercase text-muted-foreground"><Trophy className="size-4 text-gold" /> {total ?? 0} criaturas</div>
          <Button variant="ghost" className="w-full justify-start text-muted-foreground hover:text-destructive" onClick={sair}><LogOut /> Sair</Button>
        </div>
      </aside>
      {open && <Button variant="ghost" className="fixed inset-0 z-30 h-auto w-auto rounded-none bg-background/75 lg:hidden" aria-label="Fechar menu" onClick={() => setOpen(false)} />}
    </>
  );
}