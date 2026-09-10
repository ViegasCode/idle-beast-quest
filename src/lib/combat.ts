import { NATURES, RARITIES, RARITY_BASE_WEIGHTS, type Rarity } from "./game";

export const CAP_HORAS = 12;
export const CAP_MS = CAP_HORAS * 60 * 60 * 1000;
export const TURNO_MS = 1400;
export const PAUSA_ENTRE_BATALHAS_MS = 5000;
export const JANELA_CAPTURA_MS = 45_000;
export const CHANCE_CAPTURAVEL = 0.32;
export const INIMIGOS_POR_FASE = 5;
export const MAX_BATALHAS_POR_RESOLUCAO = 3000;

/* ---------------- RNG determinístico ---------------- */

export function mulberry32(seed: number) {
  let a = seed >>> 0;
  return function rng() {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function hashSeed(...nums: number[]) {
  let h = 2166136261;
  for (const n of nums) {
    h ^= Math.imul(n + 0x9e3779b9, 0x85ebca6b);
    h = Math.imul(h ^ (h >>> 13), 0xc2b2ae35);
  }
  return h >>> 0;
}

/* ---------------- Tipos e efetividade ---------------- */

export const TIPOS = [
  "Fogo",
  "Água",
  "Planta",
  "Elétrico",
  "Pedra",
  "Voador",
  "Gelo",
  "Sombra",
  "Metal",
  "Psíquico",
] as const;

const FORTE: Record<string, string[]> = {
  Fogo: ["Planta", "Gelo", "Metal"],
  Água: ["Fogo", "Pedra"],
  Planta: ["Água", "Pedra"],
  Elétrico: ["Água", "Voador"],
  Pedra: ["Fogo", "Voador", "Gelo"],
  Voador: ["Planta"],
  Gelo: ["Planta", "Voador"],
  Sombra: ["Psíquico"],
  Metal: ["Gelo", "Pedra"],
  Psíquico: ["Sombra", "Metal"],
};

const FRACO: Record<string, string[]> = {
  Fogo: ["Água", "Pedra"],
  Água: ["Planta", "Elétrico"],
  Planta: ["Fogo", "Gelo", "Voador"],
  Elétrico: ["Pedra", "Metal"],
  Pedra: ["Água", "Planta", "Metal"],
  Voador: ["Elétrico", "Gelo", "Pedra"],
  Gelo: ["Fogo", "Metal"],
  Sombra: ["Psíquico"],
  Metal: ["Fogo"],
  Psíquico: ["Sombra"],
};

export function efetividade(tipoGolpe: string, tipos: (string | null)[]) {
  let mult = 1;
  for (const t of tipos) {
    if (!t) continue;
    if (FORTE[tipoGolpe]?.includes(t)) mult *= 2;
    else if (FRACO[tipoGolpe]?.includes(t)) mult *= 0.5;
  }
  return mult;
}

export function rotuloEfetividade(mult: number) {
  if (mult >= 2) return "Super efetivo!";
  if (mult > 1) return "Efetivo";
  if (mult === 0) return "Sem efeito";
  if (mult < 1) return "Pouco efetivo";
  return "";
}

export const GOLPES: Record<string, { nome: string; power: number }[]> = {
  Fogo: [
    { nome: "Brasa Viva", power: 55 },
    { nome: "Explosão Ígnea", power: 75 },
  ],
  Água: [
    { nome: "Jato Torrencial", power: 55 },
    { nome: "Maré Colossal", power: 75 },
  ],
  Planta: [
    { nome: "Chicote de Cipó", power: 55 },
    { nome: "Lâmina Folha", power: 72 },
  ],
  Elétrico: [
    { nome: "Faísca Rápida", power: 52 },
    { nome: "Trovão Espiral", power: 78 },
  ],
  Pedra: [
    { nome: "Rocha Rolante", power: 58 },
    { nome: "Impacto Tectônico", power: 76 },
  ],
  Voador: [
    { nome: "Rajada de Asas", power: 54 },
    { nome: "Voo Cortante", power: 74 },
  ],
  Gelo: [
    { nome: "Sopro Gélido", power: 55 },
    { nome: "Estilhaço Glacial", power: 74 },
  ],
  Sombra: [
    { nome: "Garra Umbral", power: 56 },
    { nome: "Eclipse Voraz", power: 78 },
  ],
  Metal: [
    { nome: "Golpe de Aço", power: 56 },
    { nome: "Prensa Ferrosa", power: 76 },
  ],
  Psíquico: [
    { nome: "Onda Mental", power: 56 },
    { nome: "Colapso Psíquico", power: 78 },
  ],
};

export function golpeNeutro() {
  return { nome: "Investida", power: 45 };
}

/* ---------------- Combatentes ---------------- */

export type SpeciesLike = {
  id: number;
  nome: string;
  tipo_primario: string;
  tipo_secundario: string | null;
  hp_base: number;
  ataque_base: number;
  defesa_base: number;
  velocidade_base: number;
  sprite_url: string | null;
};

export type Combatente = {
  nome: string;
  nivel: number;
  tipos: (string | null)[];
  sprite_url: string | null;
  hpMax: number;
  ataque: number;
  defesa: number;
  velocidade: number;
  is_shiny?: boolean;
};

function statFinal(base: number, iv: number, nivel: number, mult: number) {
  return Math.max(1, Math.floor((((2 * base + iv) * nivel) / 100 + 5) * mult));
}

function natureMults(nature: string) {
  const n = NATURES.find((x) => x.nome === nature);
  const m: Record<string, number> = { hp: 1, ataque: 1, defesa: 1, velocidade: 1 };
  if (n) {
    m[n.up] = 1.1;
    m[n.down] = 0.9;
  }
  return m;
}

export type CreatureLike = {
  nivel: number;
  iv_hp: number;
  iv_ataque: number;
  iv_defesa: number;
  iv_velocidade: number;
  nature: string;
  is_shiny: boolean;
  species: SpeciesLike | null;
};

export function combatenteDoJogador(c: CreatureLike): Combatente {
  const s = c.species;
  const m = natureMults(c.nature);
  const hpBase = s?.hp_base ?? 45;
  return {
    nome: s?.nome ?? "Criatura",
    nivel: c.nivel,
    tipos: [s?.tipo_primario ?? "Fogo", s?.tipo_secundario ?? null],
    sprite_url: s?.sprite_url ?? null,
    is_shiny: c.is_shiny,
    hpMax: Math.max(
      12,
      Math.floor((((2 * hpBase + c.iv_hp) * c.nivel) / 50 + c.nivel + 25) * (m["hp"] ?? 1)),
    ),
    ataque: statFinal(s?.ataque_base ?? 45, c.iv_ataque, c.nivel, m["ataque"] ?? 1),
    defesa: statFinal(s?.defesa_base ?? 45, c.iv_defesa, c.nivel, m["defesa"] ?? 1),
    velocidade: statFinal(s?.velocidade_base ?? 45, c.iv_velocidade, c.nivel, m["velocidade"] ?? 1),
  };
}

export type Inimigo = {
  index: number;
  species_id: number;
  nome: string;
  nivel: number;
  is_capturavel: boolean;
  sprite_url: string | null;
  tipos: (string | null)[];
  combatente: Combatente;
};

export type RegiaoLike = {
  id: number;
  nivel_minimo: number;
  nivel_maximo: number;
  fases: number;
  species_ids: number[];
  multiplicador_raridade: number;
};

export function nivelDaFase(regiao: RegiaoLike, fase: number) {
  const fases = Math.max(1, regiao.fases);
  const span = Math.max(0, regiao.nivel_maximo - regiao.nivel_minimo);
  const t = fases === 1 ? 1 : (fase - 1) / (fases - 1);
  return Math.round(regiao.nivel_minimo + span * t);
}

/** Fila determinística de inimigos de uma fase (mesma no servidor e no navegador). */
export function inimigosDaFase(
  regiao: RegiaoLike,
  fase: number,
  pool: SpeciesLike[],
  def?: FaseDef,
): Inimigo[] {
  const definicao =
    def ?? getFaseDef(regiao.id, fase, pool.map((s) => s.id), Math.max(1, regiao.fases ?? 8));
  const elenco = pool.filter((s) => definicao.especies.includes(s.id));
  const usados = elenco.length ? elenco : pool;
  const nivelBase = nivelDaFase(regiao, fase);
  const total = inimigosDaFaseCount(definicao);
  const lista: Inimigo[] = [];
  for (let i = 0; i < total; i++) {
    const rng = mulberry32(hashSeed(regiao.id, fase, i));
    const s = usados[i % usados.length] ?? usados[0]!;
    // nível da fase + ajuste definido para a fase, com leve variação
    const nivel = Math.max(1, nivelBase + definicao.nivelBonus + Math.floor(rng() * 2));
    const iv = () => Math.floor(rng() * 26);
    const comb = combatenteDoJogador({
      nivel,
      iv_hp: iv(),
      iv_ataque: iv(),
      iv_defesa: iv(),
      iv_velocidade: iv(),
      nature: "Neutra",
      is_shiny: false,
      species: s,
    });
    comb.nome = s.nome;
    // inimigos selvagens são um pouco mais fracos que criaturas treinadas
    comb.ataque = Math.max(1, Math.round(comb.ataque * 0.5));
    comb.defesa = Math.max(1, Math.round(comb.defesa * 0.6));
    comb.hpMax = Math.max(6, Math.round(comb.hpMax * 0.75));
    lista.push({
      index: i,
      species_id: s.id,
      nome: s.nome,
      nivel,
      is_capturavel: definicao.taxaCaptura > 0,
      sprite_url: s.sprite_url,
      tipos: [s.tipo_primario, s.tipo_secundario],
      combatente: comb,
    });
  }
  return lista;
}


export function bossDaFase(regiao: RegiaoLike, fase: number, pool: SpeciesLike[]): Inimigo[] {
  const bossSpecies = pool[Math.min(pool.length - 1, Math.max(0, fase - 1))] ?? pool[0]!;
  const nivelBoss = Math.max(regiao.nivel_maximo + 2, nivelDaFase(regiao, fase) + 8);
  const comb = combatenteDoJogador({
    nivel: nivelBoss,
    iv_hp: 30,
    iv_ataque: 31,
    iv_defesa: 31,
    iv_velocidade: 26,
    nature: "Feroz",
    is_shiny: false,
    species: bossSpecies,
  });

  comb.nome = `${bossSpecies.nome} Chefe`;
  comb.ataque = Math.max(1, Math.round(comb.ataque * 1.7));
  comb.defesa = Math.max(1, Math.round(comb.defesa * 1.5));
  comb.hpMax = Math.max(50, Math.round(comb.hpMax * 2.1));
  comb.velocidade = Math.max(1, Math.round(comb.velocidade * 1.15));

  return [
    {
      index: 0,
      species_id: bossSpecies.id,
      nome: comb.nome,
      nivel: nivelBoss,
      is_capturavel: false,
      sprite_url: bossSpecies.sprite_url,
      tipos: [bossSpecies.tipo_primario, bossSpecies.tipo_secundario],
      combatente: comb,
    },
  ];
}

/* ---------------- Batalha ---------------- */

export type TurnoLog = {
  atacante: "jogador" | "inimigo";
  golpe: string;
  dano: number;
  efetividade: number;
  rotulo: string;
  hpJogador: number;
  hpInimigo: number;
};

export type ResultadoBatalha = {
  vitoria: boolean;
  turnos: TurnoLog[];
  duracaoMs: number;
  hpJogadorFinal: number;
  danoRecebido: number;
};

function escolheGolpe(c: Combatente, alvo: Combatente, rng: () => number) {
  const opcoes: { nome: string; power: number; tipo: string }[] = [];
  for (const t of c.tipos) {
    if (!t) continue;
    for (const g of GOLPES[t] ?? []) opcoes.push({ ...g, tipo: t });
  }
  const neutro = { ...golpeNeutro(), tipo: "Neutro" };
  opcoes.push(neutro);
  // favorece o golpe mais efetivo, com variação
  let melhor = opcoes[0]!;
  let melhorScore = -1;
  for (const o of opcoes) {
    const score =
      o.power * (o.tipo === "Neutro" ? 1 : efetividade(o.tipo, alvo.tipos)) * (0.85 + rng() * 0.3);
    if (score > melhorScore) {
      melhorScore = score;
      melhor = o;
    }
  }
  return melhor;
}

function dano(
  atacante: Combatente,
  defensor: Combatente,
  golpe: { power: number; tipo: string },
  rng: () => number,
) {
  const eff = golpe.tipo === "Neutro" ? 1 : efetividade(golpe.tipo, defensor.tipos);
  const bruto =
    (((2 * atacante.nivel) / 5 + 2) * atacante.ataque * golpe.power) / Math.max(1, defensor.defesa) / 55 +
    2;
  const variacao = 0.85 + rng() * 0.3;
  const critico = rng() < 0.07 ? 1.5 : 1;
  return { dano: Math.max(1, Math.floor(bruto * eff * variacao * critico)), eff };
}

export function simularBatalha(
  jogador: Combatente,
  inimigo: Combatente,
  rng: () => number,
  hpJogadorInicial?: number,
): ResultadoBatalha {
  let hpJ = Math.max(1, Math.min(hpJogadorInicial ?? jogador.hpMax, jogador.hpMax));
  let hpI = inimigo.hpMax;
  const hpInicial = hpJ;
  const turnos: TurnoLog[] = [];
  const jogadorPrimeiro = jogador.velocidade >= inimigo.velocidade;

  for (let t = 0; t < 60 && hpJ > 0 && hpI > 0; t++) {
    const ordem: ("jogador" | "inimigo")[] = jogadorPrimeiro
      ? ["jogador", "inimigo"]
      : ["inimigo", "jogador"];
    for (const quem of ordem) {
      if (hpJ <= 0 || hpI <= 0) break;
      const atacante = quem === "jogador" ? jogador : inimigo;
      const defensor = quem === "jogador" ? inimigo : jogador;
      const golpe = escolheGolpe(atacante, defensor, rng);
      const { dano: d, eff } = dano(atacante, defensor, golpe, rng);
      if (quem === "jogador") hpI = Math.max(0, hpI - d);
      else hpJ = Math.max(0, hpJ - d);
      turnos.push({
        atacante: quem,
        golpe: golpe.nome,
        dano: d,
        efetividade: eff,
        rotulo: rotuloEfetividade(eff),
        hpJogador: hpJ,
        hpInimigo: hpI,
      });
    }
  }

  return {
    vitoria: hpI <= 0 && hpJ > 0,
    turnos,
    duracaoMs: turnos.length * TURNO_MS + PAUSA_ENTRE_BATALHAS_MS,
    hpJogadorFinal: hpJ,
    danoRecebido: Math.max(0, hpInicial - hpJ),
  };
}

/* ---------------- Recompensas ---------------- */

export function expPorAbate(nivelInimigo: number) {
  // aumentar recompensa base de experiência para progressão mais rápida
  return Math.round(20 + nivelInimigo * 12);
}

export function expNecessaria(nivel: number) {
  // reduzir crescimento da curva de experiência para facilitar up
  return Math.round(40 * Math.pow(nivel, 1.35));
}

export function sortearRaridade(mult: number, rng: () => number): Rarity {
  const pesos = RARITIES.map((r) => {
    const base = RARITY_BASE_WEIGHTS[r];
    if (r === "Comum") return { r, w: base / mult };
    if (r === "Incomum") return { r, w: base };
    return { r, w: base * mult };
  });
  const total = pesos.reduce((s, p) => s + p.w, 0);
  let roll = rng() * total;
  for (const p of pesos) {
    roll -= p.w;
    if (roll <= 0) return p.r;
  }
  return "Comum";
}

/** Regeneração entre batalhas: 40% do HP máximo por batalha. */
export function regenerar(hp: number, hpMax: number) {
  return Math.min(hpMax, hp + Math.ceil(hpMax * 0.4));
}
