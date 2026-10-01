import { Swords } from "lucide-react";
import arenaBackground from "@/assets/emerald-forest-arena.png";
import type { FarmState, FarmEvent } from "@/lib/farm";
export function FarmArena({ farm, events }: { farm: FarmState; events: FarmEvent[] }) {
  const units = [...farm.team, ...farm.enemies];
  return (
    <div className="farm-arena" style={{ backgroundImage: `url(${arenaBackground})` }}>
      <div className="farm-arena-label">
        ONDA {farm.wave} · {farm.kills} ABATES NA FASE
      </div>
      {units
        .filter((u) => u.hp > 0)
        .map((u) => {
          const allied = farm.team.some((a) => a.id === u.id);
          const index = allied
            ? farm.team.findIndex((a) => a.id === u.id)
            : farm.enemies.findIndex((a) => a.id === u.id);
          return (
            <div
              key={u.id}
              className={`farm-fighter ${allied ? "farm-ally" : "farm-enemy"}`}
              style={{
                left: `${Math.min(90, Math.max(7, (u.x / 150) * 100))}%`,
                top: `${allied ? 26 + index * 23 : 22 + (index % 3) * 23}%`,
              }}
            >
              <small>
                {u.name} · Nv. {u.level}
              </small>
              <div className="pixel-meter pixel-meter-hp">
                <span style={{ width: `${(u.hp / u.maxHp) * 100}%` }} />
              </div>
              {u.sprite ? <img src={u.sprite} alt={u.name ?? "Pokémon"} /> : <Swords />}
              <small>
                {u.hp}/{u.maxHp}
              </small>
            </div>
          );
        })}
      <div className="farm-event-log" aria-live="polite">
        {events
          .filter((e) => e.type === "hit")
          .slice(-3)
          .map((e, i) => (
            <span key={`${e.timeMs}-${i}`}>
              {units.find((u) => u.id === e.actorId)?.name ?? "Atacante"} · {e.damage} de dano
            </span>
          ))}
      </div>
      {farm.defeated && (
        <strong className="farm-defeat">Time derrotado — recupere para continuar</strong>
      )}
    </div>
  );
}
