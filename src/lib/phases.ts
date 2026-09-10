/**
 * Definição real das fases de cada região.
 * Cada fase tem: nome próprio, elenco fixo de espécies inimigas, quantidade de
 * inimigos, ajuste de nível, multiplicador de drop de itens e taxa base de captura.
 * Usado tanto na simulação do servidor quanto na fila exibida na arena.
 */

export type FaseDef = {
  fase: number;
  nome: string;
  /** Espécies que aparecem nesta fase (ids da tabela species). */
  especies: number[];
  /** Quantos inimigos precisam ser derrotados para concluir a fase. */
  inimigos: number;
  /** Ajuste de nível aplicado sobre o nível base da fase. */
  nivelBonus: number;
  /** Multiplicador aplicado à chance de drop de cada item de captura. */
  dropMult: number;
  /** Taxa base de captura da fase (multiplicada pela taxa do item usado). */
  taxaCaptura: number;
  /** Fase de elite/chefe. */
  elite?: boolean;
};

export const FASE_INIMIGOS_PADRAO = 5;

function fase(
  numero: number,
  nome: string,
  especies: number[],
  inimigos: number,
  nivelBonus: number,
  dropMult: number,
  taxaCaptura: number,
): FaseDef {
  return { fase: numero, nome, especies, inimigos, nivelBonus, dropMult, taxaCaptura };
}

/** Fases por região (chave = regions.id). */
export const FASES_POR_REGIAO: Record<number, FaseDef[]> = {
  // Campina Esmeralda — pool: 1,2,3,4,5,6,7
  1: [
    fase(1, "Trilha das Sementes", [3, 7], 4, -1, 0.9, 0.42),
    fase(2, "Riacho Sereno", [2, 7], 5, 0, 1, 0.4),
    fase(3, "Clareira Faiscante", [4, 6], 5, 0, 1.05, 0.38),
    fase(4, "Pedreira Baixa", [5, 4], 6, 1, 1.1, 0.36),
    fase(5, "Campo Aberto", [1, 6, 7], 6, 1, 1.15, 0.34),
    fase(6, "Vale do Vento", [6, 2, 5], 6, 2, 1.2, 0.32),
    fase(7, "Cume da Campina", [1, 4, 5], 7, 2, 1.3, 0.3),
    fase(8, "Portal Esmeralda", [1, 2, 3], 7, 3, 1.45, 0.28),
  ],
  // Floresta Sussurrante — pool: 3,6,7,8,10,11,13
  2: [
    fase(1, "Bosque Úmido", [3, 7], 5, -1, 1, 0.36),
    fase(2, "Copas Sussurrantes", [6, 7], 5, 0, 1.05, 0.35),
    fase(3, "Lago Escondido", [10, 8], 6, 0, 1.1, 0.33),
    fase(4, "Raízes Antigas", [13, 3], 6, 1, 1.15, 0.31),
    fase(5, "Névoa Gélida", [8, 6], 6, 1, 1.2, 0.29),
    fase(6, "Sombras do Musgo", [11, 7], 7, 2, 1.25, 0.27),
    fase(7, "Santuário Psíquico", [13, 11], 7, 2, 1.35, 0.25),
    fase(8, "Coração da Floresta", [10, 11, 13], 8, 3, 1.5, 0.23),
  ],
  // Caverna Cintilante — pool: 5,8,9,11,12,14
  3: [
    fase(1, "Entrada de Pedra", [5, 8], 5, -1, 1.05, 0.3),
    fase(2, "Galeria Cintilante", [12, 5], 6, 0, 1.1, 0.29),
    fase(3, "Veias de Metal", [14, 12], 6, 0, 1.15, 0.27),
    fase(4, "Poço Sombrio", [11, 8], 6, 1, 1.2, 0.26),
    fase(5, "Fenda Ardente", [9, 5], 7, 1, 1.25, 0.24),
    fase(6, "Câmara Magnética", [12, 14], 7, 2, 1.3, 0.22),
    fase(7, "Abismo Umbral", [11, 9], 8, 2, 1.4, 0.2),
    fase(8, "Núcleo Cristalino", [14, 12, 9], 8, 3, 1.6, 0.18),
  ],
  // Pico Vulcânico — pool: 9,12,14,15,16,17,18
  4: [
    fase(1, "Encosta de Cinzas", [9, 14], 6, -1, 1.1, 0.24),
    fase(2, "Corredor de Lava", [9, 16], 6, 0, 1.15, 0.23),
    fase(3, "Cume Congelado", [15, 12], 7, 0, 1.2, 0.21),
    fase(4, "Forja Natural", [16, 14], 7, 1, 1.25, 0.2),
    fase(5, "Poço Abissal", [17, 15], 7, 1, 1.3, 0.18),
    fase(6, "Tempestade de Brasas", [16, 9, 12], 8, 2, 1.4, 0.17),
    fase(7, "Trono Sombrio", [17, 11 /* fallback filtrado pelo pool */, 15], 8, 2, 1.5, 0.15),
    fase(8, "Ápice Dourado", [18, 16, 17], 9, 3, 1.75, 0.13),
  ],
};

/** Fase de chefe: elenco vem da própria região, drop alto e sem captura. */
function faseChefe(numero: number, especies: number[]): FaseDef {
  return {
    fase: numero,
    nome: "Confronto do Chefe",
    especies,
    inimigos: 1,
    nivelBonus: 8,
    dropMult: 3,
    taxaCaptura: 0,
    elite: true,
  };
}

/** Fase gerada quando a região não tem definição própria. */
function faseGenerica(numero: number, especies: number[], totalFases: number): FaseDef {
  const t = totalFases <= 1 ? 1 : (numero - 1) / (totalFases - 1);
  const janela = Math.max(2, Math.ceil(especies.length / 2));
  const inicio = Math.min(Math.max(0, especies.length - janela), Math.floor(t * especies.length));
  return {
    fase: numero,
    nome: `Fase ${numero}`,
    especies: especies.slice(inicio, inicio + janela),
    inimigos: FASE_INIMIGOS_PADRAO + Math.floor(t * 2),
    nivelBonus: Math.round(t * 3) - 1,
    dropMult: 1 + t * 0.5,
    taxaCaptura: 0.4 - t * 0.15,
  };
}

/**
 * Retorna a definição da fase pedida, sempre filtrando as espécies pelo pool real
 * da região para nunca gerar um inimigo fora dela.
 */
export function getFaseDef(
  regionId: number,
  faseNumero: number,
  poolIds: number[],
  totalFases: number,
): FaseDef {
  const bossPhase = Math.max(1, totalFases + 1);
  const pool = poolIds.length ? poolIds : [];
  const filtra = (ids: number[]) => {
    const validos = ids.filter((id) => pool.includes(id));
    return validos.length ? validos : pool;
  };

  if (faseNumero >= bossPhase) return faseChefe(faseNumero, filtra(pool.slice(-2)));

  const def = FASES_POR_REGIAO[regionId]?.find((entry) => entry.fase === faseNumero);
  const base = def ?? faseGenerica(faseNumero, pool, totalFases);
  return { ...base, especies: filtra(base.especies) };
}

/** Quantidade de inimigos da fase (usada na barra de progresso e na resolução). */
export function inimigosDaFaseCount(def: FaseDef) {
  return Math.max(1, def.inimigos);
}
