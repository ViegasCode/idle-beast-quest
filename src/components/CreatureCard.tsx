import { rarityClass, natureInfo, STAT_LABELS } from "@/lib/game";

type Species = {
  nome: string;
  tipo_primario: string;
  tipo_secundario: string | null;
  sprite_url: string | null;
};

export type CreatureRow = {
  id: string;
  nivel: number;
  iv_hp: number;
  iv_ataque: number;
  iv_defesa: number;
  iv_velocidade: number;
  nature: string;
  raridade: string;
  is_shiny: boolean;
  species: Species | null;
};

function IvBar({ label, value }: { label: string; value: number }) {
  return (
    <div>
      <div className="flex justify-between text-[11px] text-muted-foreground">
        <span>{label}</span>
        <span className="font-semibold text-foreground">{value}</span>
      </div>
      <div className="mt-1 h-1.5 overflow-hidden rounded-full bg-secondary">
        <div
          className="h-full rounded-full bg-primary"
          style={{ width: `${(value / 31) * 100}%` }}
        />
      </div>
    </div>
  );
}

export function CreatureCard({ creature }: { creature: CreatureRow }) {
  const s = creature.species;
  const nat = natureInfo(creature.nature);
  return (
    <article
      className={`rarity-card p-4 ${rarityClass(creature.raridade)} ${
        creature.is_shiny ? "shiny-card" : ""
      }`}
    >
      <div className="flex items-start gap-3">
        <div className="grid size-16 shrink-0 place-items-center overflow-hidden rounded-xl bg-secondary/60">
          {s?.sprite_url ? (
            <img src={s.sprite_url} alt={s.nome} className="size-14" loading="lazy" />
          ) : null}
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="truncate text-base font-bold">{s?.nome ?? "Criatura"}</h3>
            {creature.is_shiny && (
              <span className="rounded-full bg-accent px-2 py-0.5 text-[10px] font-bold text-accent-foreground">
                SHINY
              </span>
            )}
          </div>
          <p className="text-xs text-muted-foreground">
            {s?.tipo_primario}
            {s?.tipo_secundario ? ` / ${s.tipo_secundario}` : ""}
          </p>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rarity-chip rounded-full px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide">
              {creature.raridade}
            </span>
            <span className="rounded-full border border-border px-2 py-0.5 text-[10px] font-semibold">
              Nv. {creature.nivel}
            </span>
          </div>
        </div>
      </div>

      <p className="mt-3 text-xs text-muted-foreground">
        Nature <span className="font-semibold text-foreground">{creature.nature}</span>
        {nat ? ` · +10% ${STAT_LABELS[nat.up]} / -10% ${STAT_LABELS[nat.down]}` : ""}
      </p>

      <div className="mt-3 grid grid-cols-2 gap-x-3 gap-y-2">
        <IvBar label="IV HP" value={creature.iv_hp} />
        <IvBar label="IV Ataque" value={creature.iv_ataque} />
        <IvBar label="IV Defesa" value={creature.iv_defesa} />
        <IvBar label="IV Velocidade" value={creature.iv_velocidade} />
      </div>
    </article>
  );
}
