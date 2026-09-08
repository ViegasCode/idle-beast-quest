import { useEffect, useRef, useState } from "react";
import {
  PAUSA_ENTRE_BATALHAS_MS,
  TURNO_MS,
  simularBatalha,
  type Combatente,
  type Inimigo,
  type TurnoLog,
} from "@/lib/combat";

type Props = {
  jogador: Combatente;
  fila: Inimigo[];
  indiceInicial: number;
};

function Barra({ atual, max, cor }: { atual: number; max: number; cor: string }) {
  const pct = Math.max(0, Math.min(100, (atual / Math.max(1, max)) * 100));
  return (
    <div className="h-2.5 overflow-hidden rounded-full bg-secondary">
      <div
        className={`h-full rounded-full transition-[width] duration-300 ${cor}`}
        style={{ width: `${pct}%` }}
      />
    </div>
  );
}

function Lado({
  nome,
  nivel,
  tipos,
  sprite,
  hp,
  hpMax,
  cor,
  atacando,
  dano,
  shiny,
}: {
  nome: string;
  nivel: number;
  tipos: (string | null)[];
  sprite: string | null;
  hp: number;
  hpMax: number;
  cor: string;
  atacando: boolean;
  dano: number | null;
  shiny?: boolean | undefined;
}) {
  return (
    <div className="flex-1">
      <div className="flex items-center justify-between gap-2 text-xs">
        <span className="truncate font-bold">{nome}</span>
        <span className="text-muted-foreground">Nv. {nivel}</span>
      </div>
      <div className="mt-1">
        <Barra atual={hp} max={hpMax} cor={cor} />
      </div>
      <p className="mt-1 text-[11px] tabular-nums text-muted-foreground">
        {hp}/{hpMax} HP
      </p>
      <div className="relative mt-2 grid h-24 place-items-center rounded-2xl bg-secondary/40">
        {sprite ? (
          <img
            src={sprite}
            alt={nome}
            className={`size-20 transition-transform duration-200 ${atacando ? "scale-110 -translate-y-1" : ""} ${
              shiny ? "drop-shadow-[0_0_10px_rgba(251,191,36,0.9)]" : ""
            }`}
          />
        ) : (
          <span className="text-xs text-muted-foreground">{nome}</span>
        )}
        {dano !== null && (
          <span className="animate-in absolute right-3 top-2 text-sm font-extrabold text-destructive">
            -{dano}
          </span>
        )}
      </div>
      <p className="mt-1 text-center text-[11px] text-muted-foreground">
        {tipos.filter(Boolean).join(" / ")}
      </p>
    </div>
  );
}

export function CombatArena({ jogador, fila, indiceInicial }: Props) {
  const [idx, setIdx] = useState(indiceInicial);
  const [hpJ, setHpJ] = useState(jogador.hpMax);
  const [hpI, setHpI] = useState(0);
  const [turno, setTurno] = useState<TurnoLog | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setIdx(indiceInicial);
  }, [indiceInicial, fila]);

  useEffect(() => {
    const inimigo = fila[idx % Math.max(1, fila.length)];
    if (!inimigo) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const res = simularBatalha(jogador, inimigo.combatente, Math.random, hpJ);
    setHpI(inimigo.combatente.hpMax);

    res.turnos.forEach((t, i) => {
      timers.current.push(
        setTimeout(() => {
          setTurno(t);
          setHpJ(t.hpJogador);
          setHpI(t.hpInimigo);
          setLog((prev) =>
            [
              `${t.atacante === "jogador" ? jogador.nome : inimigo.nome} usou ${t.golpe} · ${t.dano} de dano${
                t.rotulo ? ` · ${t.rotulo}` : ""
              }`,
              ...prev,
            ].slice(0, 8),
          );
        }, i * TURNO_MS),
      );
    });

    timers.current.push(
      setTimeout(() => {
        setLog((prev) =>
          [
            res.vitoria
              ? `${inimigo.nome} foi derrotado!${inimigo.is_capturavel ? " (capturável)" : ""}`
              : `${jogador.nome} recuou para se recuperar.`,
            ...prev,
          ].slice(0, 8),
        );
        setHpJ(
          res.vitoria
            ? Math.min(jogador.hpMax, res.hpJogadorFinal + Math.ceil(jogador.hpMax * 0.4))
            : jogador.hpMax,
        );
        setTurno(null);
        setIdx((v) => (v + 1) % Math.max(1, fila.length));
      }, res.turnos.length * TURNO_MS + PAUSA_ENTRE_BATALHAS_MS),
    );

    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, fila, jogador]);

  const inimigo = fila[idx % Math.max(1, fila.length)];
  if (!inimigo) return <p className="text-sm text-muted-foreground">Sem inimigos nesta região.</p>;

  return (
    <div>
      <div className="flex items-start gap-4">
        <Lado
          nome={jogador.nome}
          nivel={jogador.nivel}
          tipos={jogador.tipos}
          sprite={jogador.sprite_url}
          hp={hpJ}
          hpMax={jogador.hpMax}
          cor="bg-gradient-to-r from-primary to-accent"
          atacando={turno?.atacante === "jogador"}
          dano={turno?.atacante === "inimigo" ? turno.dano : null}
          shiny={jogador.is_shiny}
        />
        <div className="mt-10 shrink-0 text-center">
          <span className="font-display text-xl font-extrabold text-muted-foreground">VS</span>
          {turno && turno.rotulo === "Super efetivo!" && (
            <p className="mt-1 text-[10px] font-extrabold uppercase text-accent">super efetivo</p>
          )}
        </div>
        <Lado
          nome={inimigo.nome}
          nivel={inimigo.nivel}
          tipos={inimigo.tipos}
          sprite={inimigo.sprite_url}
          hp={hpI}
          hpMax={inimigo.combatente.hpMax}
          cor="bg-destructive"
          atacando={turno?.atacante === "inimigo"}
          dano={turno?.atacante === "jogador" ? turno.dano : null}
        />
      </div>

      <div className="mt-4 flex flex-wrap gap-2 text-[10px]">
        {fila.map((e, i) => (
          <span
            key={e.index}
            className={`rounded-full border px-2 py-1 font-semibold ${
              i === idx % fila.length
                ? "border-primary bg-primary/20 text-foreground"
                : i < idx % fila.length
                  ? "border-border text-muted-foreground line-through"
                  : "border-border text-muted-foreground"
            }`}
          >
            {e.nome} Nv.{e.nivel}
            {e.is_capturavel ? " ◎" : ""}
          </span>
        ))}
      </div>

      <div className="mt-4 max-h-40 space-y-1 overflow-hidden rounded-xl bg-surface-2/50 p-3 text-[11px] text-muted-foreground">
        {log.length === 0 ? <p>Iniciando combate...</p> : log.map((l, i) => <p key={i}>{l}</p>)}
      </div>
    </div>
  );
}
