import { useEffect, useRef, useState } from "react";
import { Crosshair, Sparkles, Swords } from "lucide-react";
import arenaBackground from "@/assets/emerald-forest-arena.png";
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
  time?: Combatente[];
  regiao?: { nome?: string } | null;
};

function HpBar({ atual, max }: { atual: number; max: number }) {
  const pct = Math.max(0, Math.min(100, (atual / Math.max(1, max)) * 100));
  return (
    <div className="pixel-meter pixel-meter-hp">
      <span style={{ width: `${pct}%` }} />
    </div>
  );
}

export function CombatArena({ jogador, fila, indiceInicial, time }: Props) {
  const [idx, setIdx] = useState(indiceInicial);
  const [hpJ, setHpJ] = useState(jogador.hpMax);
  const [hpI, setHpI] = useState(0);
  const [turno, setTurno] = useState<TurnoLog | null>(null);
  const [log, setLog] = useState<string[]>([]);
  const [enemyDamage, setEnemyDamage] = useState<number | null>(null);
  const [teamDamage, setTeamDamage] = useState<number | null>(null);
  const timers = useRef<ReturnType<typeof setTimeout>[]>([]);

  useEffect(() => setIdx(indiceInicial), [indiceInicial, fila]);

  useEffect(() => {
    const inimigo = fila[idx % Math.max(1, fila.length)];
    if (!inimigo) return;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    const members = time?.length ? time : [jogador];
    const atacante: Combatente = {
      ...jogador,
      ataque: members.reduce((sum, member) => sum + member.ataque, 0),
      defesa: Math.max(1, Math.round(members.reduce((sum, member) => sum + member.defesa, 0) / members.length)),
      velocidade: Math.max(...members.map((member) => member.velocidade)),
      tipos: Array.from(new Set(members.flatMap((member) => member.tipos.filter(Boolean)))) as string[],
    };
    const result = simularBatalha(atacante, inimigo.combatente, Math.random, hpJ);
    setHpI(inimigo.combatente.hpMax);

    result.turnos.forEach((entry, turnIndex) => {
      timers.current.push(setTimeout(() => {
        setTurno(entry);
        setHpJ(entry.hpJogador);
        setHpI(entry.hpInimigo);
        setLog((previous) => [
          `${entry.atacante === "jogador" ? atacante.nome : inimigo.nome} usou ${entry.golpe}${entry.rotulo ? ` · ${entry.rotulo}` : ""}`,
          ...previous,
        ].slice(0, 3));
        if (entry.atacante === "jogador") {
          setEnemyDamage(entry.dano);
          timers.current.push(setTimeout(() => setEnemyDamage(null), 850));
        } else {
          setTeamDamage(entry.dano);
          timers.current.push(setTimeout(() => setTeamDamage(null), 850));
        }
      }, 900 + turnIndex * TURNO_MS));
    });

    timers.current.push(setTimeout(() => {
      setLog((previous) => [result.vitoria ? `${inimigo.nome} foi derrotado!` : `${atacante.nome} recuou.`, ...previous].slice(0, 3));
      setHpJ(result.vitoria ? Math.min(jogador.hpMax, result.hpJogadorFinal + Math.ceil(jogador.hpMax * 0.4)) : jogador.hpMax);
      setTurno(null);
      setIdx((value) => (value + 1) % Math.max(1, fila.length));
    }, 900 + result.turnos.length * TURNO_MS + PAUSA_ENTRE_BATALHAS_MS));

    return () => timers.current.forEach(clearTimeout);
  }, [idx, fila, jogador, time]);

  const inimigo = fila[idx % Math.max(1, fila.length)];
  if (!inimigo) return <div className="pixel-empty">Nenhum inimigo nesta região</div>;

  return (
    <div className="battle-stage" style={{ backgroundImage: `url(${arenaBackground})` }}>
      <div className="battle-vignette" />
      <div className="battle-auto"><span /> AUTO COMBATE</div>

      <div className="fighter fighter-player">
        <div className="fighter-plate">
          <div className="fighter-title"><span>{jogador.nome}</span><b>Nv. {jogador.nivel}</b></div>
          <HpBar atual={hpJ} max={jogador.hpMax} />
          <small>{hpJ} / {jogador.hpMax}</small>
        </div>
        <div className={turno?.atacante === "jogador" ? "fighter-sprite is-attacking" : "fighter-sprite"}>
          {jogador.sprite_url ? <img src={jogador.sprite_url} alt={jogador.nome} /> : <Swords />}
          {teamDamage !== null && <strong className="damage-number damage-player">-{teamDamage}</strong>}
        </div>
      </div>

      <div className="battle-center-log">
        {turno?.rotulo && <strong>{turno.rotulo}</strong>}
        <span><Crosshair /> {log[0] ?? "Iniciando confronto..."}</span>
      </div>

      <div className="fighter fighter-enemy">
        <div className="fighter-plate">
          <div className="fighter-title">
            <span>{inimigo.nome}</span><b>Nv. {inimigo.nivel}</b>
          </div>
          <HpBar atual={hpI} max={inimigo.combatente.hpMax} />
          <small>{hpI} / {inimigo.combatente.hpMax}</small>
        </div>
        <div className={turno?.atacante === "inimigo" ? "fighter-sprite is-attacking" : "fighter-sprite"}>
          {inimigo.sprite_url ? <img src={inimigo.sprite_url} alt={inimigo.nome} /> : <Swords />}
          {inimigo.is_capturavel && <span className="catchable-mark"><Sparkles /> CAPTURÁVEL</span>}
          {enemyDamage !== null && <strong className="damage-number">-{enemyDamage}</strong>}
        </div>
      </div>

      <div className="enemy-queue" aria-label="Fila de inimigos">
        {fila.map((enemy, index) => (
          <span key={enemy.index} className={index === idx % fila.length ? "is-current" : ""} title={`${enemy.nome} Nv. ${enemy.nivel}`}>
            {enemy.sprite_url ? <img src={enemy.sprite_url} alt="" /> : index + 1}
          </span>
        ))}
      </div>
    </div>
  );
}