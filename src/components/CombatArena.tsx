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
  // time opcional para exibir até 3 criaturas no campo (UI apenas)
  time?: Combatente[];
  regiao?: any;
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

export function CombatArena({ jogador, fila, indiceInicial, time, regiao }: Props) {
  const [idx, setIdx] = useState(indiceInicial);
  const [hpJ, setHpJ] = useState(jogador.hpMax);
  const [hpI, setHpI] = useState(0);
  const [pos, setPos] = useState(0); // posição horizontal do time (0-100)
  const [enemyPos, setEnemyPos] = useState(0); // enemy translate percent (0 to -x)
  const [turno, setTurno] = useState<TurnoLog | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [enemyDamages, setEnemyDamages] = useState<{ key: string; amount: number }[]>([]);
  const [teamDamages, setTeamDamages] = useState<{ key: string; amount: number }[]>([]);
  const [enemyVisible, setEnemyVisible] = useState(true);
  const WALK_MS = 2000;
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => {
    setIdx(indiceInicial);
  }, [indiceInicial, fila]);

  useEffect(() => {
    const inimigo = fila[idx % Math.max(1, fila.length)];
    if (!inimigo) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    // Agregação do time: se houver um time, cria um combatente agregado que representa ataques simultâneos
    function aggregateTeam(team: Combatente[] | undefined, leader: Combatente): Combatente {
      if (!team || team.length === 0) return leader;
      const ataque = team.reduce((s, t) => s + (t.ataque ?? 0), 0);
      const defesa = Math.max(1, Math.round(team.reduce((s, t) => s + (t.defesa ?? 0), 0) / team.length));
      const velocidade = Math.max(...team.map((t) => t.velocidade ?? 0), leader.velocidade);
      const tipos = Array.from(new Set(team.flatMap((t) => t.tipos.filter(Boolean) as string[])));
      return {
        nome: leader.nome,
        nivel: leader.nivel,
        tipos: tipos as (string | null)[],
        sprite_url: leader.sprite_url,
        hpMax: leader.hpMax,
        ataque,
        defesa,
        velocidade,
      } as Combatente;
    }

    const attacker = aggregateTeam(time, jogador);
    const walkDelay = WALK_MS; // ms que o time anda antes de iniciar a troca de golpes
    const res = simularBatalha(attacker, inimigo.combatente, Math.random, hpJ);
    setHpI(inimigo.combatente.hpMax);

    // animação de caminhada: move time para a direita e inimigo para a esquerda antes de iniciar os turnos
    setPos(55);
    // start enemy off-screen to the right; it will walk in after WALK_MS
    setEnemyPos(30);
    setEnemyVisible(true);
    setTimeout(() => setEnemyPos(0), walkDelay);
    // iniciar turnos após walkDelay
    res.turnos.forEach((t, i) => {
      timers.current.push(
        setTimeout(() => {
          setTurno(t);
          setHpJ(t.hpJogador);
          setHpI(t.hpInimigo);
          setLog((prev) =>
            [
              `${t.atacante === "jogador" ? attacker.nome : inimigo.nome} usou ${t.golpe} · ${t.dano} de dano${
                t.rotulo ? ` · ${t.rotulo}` : ""
              }`,
              ...prev,
            ].slice(0, 8),
          );

          // mostrar número de dano animado
          if (t.atacante === "jogador") {
            const key = String(Date.now()) + Math.random();
            setEnemyDamages((s) => [...s, { key, amount: t.dano }]);
            setTimeout(() => setEnemyDamages((s) => s.filter((x) => x.key !== key)), 900);
          } else {
            const key = String(Date.now()) + Math.random();
            setTeamDamages((s) => [...s, { key, amount: t.dano }]);
            setTimeout(() => setTeamDamages((s) => s.filter((x) => x.key !== key)), 900);
          }
        }, walkDelay + i * TURNO_MS),
      );
    });

    // fim da batalha
    timers.current.push(
      setTimeout(() => {
        setLog((prev) =>
          [
            res.vitoria ? `${inimigo.nome} foi derrotado!` : `${attacker.nome} recuou para se recuperar.`,
            ...prev,
          ].slice(0, 8),
        );
        setHpJ(
          res.vitoria
            ? Math.min(jogador.hpMax, res.hpJogadorFinal + Math.ceil(jogador.hpMax * 0.4))
            : jogador.hpMax,
        );
        setTurno(null);
        // pequeno delay para resetar posição visual
        setTimeout(() => {
          setPos(0);
          // push enemy out slightly then reset to neutral position
          setEnemyPos(30);
          setTimeout(() => setEnemyPos(0), 200);
        }, 300);
        setIdx((v) => (v + 1) % Math.max(1, fila.length));
      }, walkDelay + res.turnos.length * TURNO_MS + PAUSA_ENTRE_BATALHAS_MS),
    );

    return () => timers.current.forEach(clearTimeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx, fila, jogador]);

  const inimigo = fila[idx % Math.max(1, fila.length)];
  if (!inimigo) return <p className="text-sm text-muted-foreground">Sem inimigos nesta região.</p>;

  // cálculo de HP por membro para exibir barras individuais com base no HP agregado
  const members = time ? time.slice(0, 3) : [];
  const totalTeamHp = members.reduce((s, m) => s + (m.hpMax ?? 0), 0) || jogador.hpMax;
  const teamHp = hpJ; // HP atual do atacante agregado
  const memberHps = members.map((m) => {
    const share = (m.hpMax ?? 0) / Math.max(1, totalTeamHp);
    const cur = Math.max(0, Math.round(share * teamHp));
    return { id: m.nome + String(m.nivel), cur, max: m.hpMax ?? 0, nome: m.nome, sprite: m.sprite_url };
  });

  function biomeClasses(regiao: any) {
    const nome = String(regiao?.nome ?? "").toLowerCase();
    if (nome.includes("gelo") || nome.includes("ice"))
      return { sky: "bg-gradient-to-b from-slate-300 to-white", ground: "bg-white/60" };
    if (nome.includes("deserto") || nome.includes("sand") || nome.includes("areia"))
      return { sky: "bg-gradient-to-b from-yellow-200 to-amber-400", ground: "bg-amber-200" };
    if (nome.includes("floresta") || nome.includes("bosque") || nome.includes("forest"))
      return { sky: "bg-gradient-to-b from-green-300 to-emerald-600", ground: "bg-green-700/40" };
    if (nome.includes("sombra") || nome.includes("necro"))
      return { sky: "bg-gradient-to-b from-violet-900 to-slate-800", ground: "bg-slate-800/40" };
    // padrão: campo
    return { sky: "bg-gradient-to-b from-sky-300 to-cyan-300", ground: "bg-green-500/30" };
  }

  const biome = biomeClasses(regiao);

  return (
    <div>
      {/** Mapa horizontal com time à esquerda e inimigo à direita; barras de vida abaixo de cada um */}
      <div className={`mb-3 overflow-hidden rounded-xl p-2 ${biome.sky}`}> 
        <div className={`relative h-44 w-full`}>
          <div className={`absolute left-0 bottom-0 h-12 w-full ${biome.ground}`} />
          <div
            className="absolute left-0 top-8 flex items-center gap-6 transition-transform"
            style={{ transform: `translateX(${pos}%)`, transition: "transform 800ms linear" }}
          >
            {/* membros do time em linha */}
            {members.length > 0 ? (
              members.map((t, i) => (
                <div key={i} className="grid w-28 place-items-center overflow-hidden rounded-xl bg-secondary/40 p-2 text-center">
                  {t.sprite_url ? (
                    <img src={t.sprite_url} alt={t.nome} className="size-12" />
                  ) : (
                    <span className="text-xs text-muted-foreground">{t.nome}</span>
                  )}
                  <span className="mt-1 text-[11px] font-semibold">Nv. {t.nivel}</span>
                  <div className="mt-2 w-full">
                    <Barra atual={memberHps[i]?.cur ?? 0} max={memberHps[i]?.max ?? 1} cor="bg-gradient-to-r from-primary to-accent" />
                    <p className="text-[10px] mt-1 text-muted-foreground">{(memberHps[i]?.cur ?? 0)}/{memberHps[i]?.max ?? 0}</p>
                  </div>
                </div>
              ))
            ) : (
              <div className="grid w-28 place-items-center rounded-xl bg-secondary/40 p-2 text-center">
                <span className="text-xs text-muted-foreground">{jogador.nome}</span>
                <span className="mt-1 text-[11px] font-semibold">Nv. {jogador.nivel}</span>
                <div className="mt-2 w-full">
                  <Barra atual={hpJ} max={jogador.hpMax} cor="bg-gradient-to-r from-primary to-accent" />
                  <p className="text-[10px] mt-1 text-muted-foreground">{hpJ}/{jogador.hpMax}</p>
                </div>
              </div>
            )}
            {/* danos recebidos pelo time (do inimigo) — mostrados ao centro do grupo */}
            {teamDamages.map((d) => (
              <span
                key={d.key}
                className="animate-in absolute -top-6 left-36 text-sm font-extrabold text-destructive"
              >
                -{d.amount}
              </span>
            ))}
          </div>

          <div className="absolute right-6 top-8 grid place-items-center text-center"
            style={{ transform: `translateX(${enemyPos}%)`, transition: "transform 800ms linear" }}>
            {/* inimigo no mapa */}
            {inimigo.sprite_url ? (
              <img src={inimigo.sprite_url} alt={inimigo.nome} className="size-16" />
            ) : (
              <div className="size-16 grid place-items-center rounded-xl bg-destructive/20 text-sm text-muted-foreground">
                {inimigo.nome}
              </div>
            )}
            <div className="mt-2 w-36">
              <Barra atual={hpI} max={inimigo.combatente.hpMax} cor="bg-destructive" />
              <p className="text-[10px] mt-1 text-muted-foreground">{hpI}/{inimigo.combatente.hpMax}</p>
            </div>
            {/* danos no inimigo (vindos do time) */}
            {enemyDamages.map((d) => (
              <span key={d.key} className="animate-in absolute -top-8 right-0 text-sm font-extrabold text-destructive">
                -{d.amount}
              </span>
            ))}
          </div>
        </div>
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
