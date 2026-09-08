export const TICK_MINUTES = 15;
export const MAX_HOURS = 12;
export const MAX_MS = MAX_HOURS * 60 * 60 * 1000;
export const CAPTURE_CHANCE = 0.6;
export const SHINY_CHANCE = 1 / 500;

export const RARITIES = ["Comum", "Incomum", "Raro", "Épico", "Mítico"] as const;
export type Rarity = (typeof RARITIES)[number];

export const RARITY_BASE_WEIGHTS: Record<Rarity, number> = {
  Comum: 60,
  Incomum: 25,
  Raro: 10,
  Épico: 4,
  Mítico: 1,
};

export const NATURES: { nome: string; up: string; down: string }[] = [
  { nome: "Ardente", up: "ataque", down: "defesa" },
  { nome: "Serena", up: "defesa", down: "ataque" },
  { nome: "Veloz", up: "velocidade", down: "hp" },
  { nome: "Robusta", up: "hp", down: "velocidade" },
  { nome: "Astuta", up: "velocidade", down: "defesa" },
  { nome: "Tenaz", up: "defesa", down: "velocidade" },
  { nome: "Feroz", up: "ataque", down: "hp" },
  { nome: "Vital", up: "hp", down: "ataque" },
  { nome: "Sutil", up: "defesa", down: "hp" },
  { nome: "Impetuosa", up: "ataque", down: "velocidade" },
];

export function natureInfo(nome: string) {
  return NATURES.find((n) => n.nome === nome);
}

export const STAT_LABELS: Record<string, string> = {
  hp: "HP",
  ataque: "Ataque",
  defesa: "Defesa",
  velocidade: "Velocidade",
};

export function rarityClass(r: string) {
  switch (r) {
    case "Mítico":
      return "rarity-mitico";
    case "Épico":
      return "rarity-epico";
    case "Raro":
      return "rarity-raro";
    case "Incomum":
      return "rarity-incomum";
    default:
      return "rarity-comum";
  }
}

export function formatDuration(ms: number) {
  const total = Math.max(0, Math.floor(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return `${String(h).padStart(2, "0")}h ${String(m).padStart(2, "0")}m ${String(s).padStart(2, "0")}s`;
}
