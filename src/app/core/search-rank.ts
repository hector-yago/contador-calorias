import { Food } from './models';

export const normalize = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '');

export const tokenize = (q: string): string[] => normalize(q).split(/[^a-z0-9]+/).filter(Boolean);

/**
 * Alimentos básicos (palabra en español → categoría de Open Food Facts). Una consulta como "leche"
 * busca primero en la categoría real de leches, en vez de en cualquier producto que la mencione.
 * Etiquetas verificadas con productos de España.
 */
export const CATEGORY_HINTS: Record<string, string> = {
  leche: 'en:milks',
  yogur: 'en:yogurts',
  queso: 'en:cheeses',
  huevo: 'en:eggs',
  pan: 'en:breads',
  jamon: 'en:hams',
  pollo: 'en:chicken-meats',
  pavo: 'en:turkey-meats',
  cerdo: 'en:pork-meats',
  ternera: 'en:beef-meats',
  arroz: 'en:rice',
  pasta: 'en:pastas',
  aceite: 'en:vegetable-oils',
  galleta: 'en:biscuits',
  cereal: 'en:breakfast-cereals',
  chocolate: 'en:chocolates',
  zumo: 'en:fruit-juices',
  atun: 'en:tunas',
  pescado: 'en:fishes',
  salchicha: 'en:sausages',
  mantequilla: 'en:butters',
  cola: 'en:colas',
  agua: 'en:waters',
  cerveza: 'en:beers',
  vino: 'en:wines',
  lenteja: 'en:lentils',
  legumbre: 'en:legumes',
  patata: 'en:potatoes',
  pizza: 'en:pizzas',
  helado: 'en:ice-creams-and-sorbets',
  azucar: 'en:sugars',
  cafe: 'en:coffees',
  fruta: 'en:fruits',
  verdura: 'en:vegetables',
  tomate: 'en:tomatoes',
  mayonesa: 'en:mayonnaises',
  ketchup: 'en:ketchup',
  ensalada: 'en:salads',
  beicon: 'en:bacon',
  bacon: 'en:bacon',
  mermelada: 'en:jams',
  sopa: 'en:soups',
  salsa: 'en:sauces',
};

export interface CategoryHint {
  tag: string;
  /** Posición del token de la consulta que ha dado la pista. */
  index: number;
}

const variants = (t: string): string[] => {
  const out = [t];
  if (t.endsWith('es')) out.push(t.slice(0, -2));
  if (t.endsWith('s')) out.push(t.slice(0, -1));
  return out;
};

export const findCategoryHint = (tokens: string[]): CategoryHint | null => {
  for (let i = 0; i < tokens.length; i++) {
    const t = tokens[i];
    for (const v of variants(t)) {
      if (CATEGORY_HINTS[v]) return { tag: CATEGORY_HINTS[v], index: i };
    }
    // Palabra a medias ("lech" → leche), solo si es lo último que se está escribiendo.
    if (i === tokens.length - 1 && t.length >= 4) {
      const key = Object.keys(CATEGORY_HINTS).find((k) => k.startsWith(t) && k.length - t.length <= 3);
      if (key) return { tag: CATEGORY_HINTS[key], index: i };
    }
  }
  return null;
};

const wordsOf = (s: string): string[] => normalize(s).split(/[^a-z0-9]+/).filter(Boolean);

/** Cuánto encaja un token con el nombre: prefijo de palabra, mejor cuanto antes y más exacto. */
const nameMatch = (words: string[], t: string): number => {
  const i = words.findIndex((w) => w.startsWith(t));
  if (i < 0) return -1;
  return 100 - 12 * Math.min(i, 6) + (words[i] === t ? 30 : 0);
};

export interface RankOptions {
  /** Token que ya garantiza la categoría: no se exige en el nombre, solo suma si aparece. */
  hintIndex?: number;
  /** Si es true, descarta productos que no encajan con todos los demás tokens. */
  strict?: boolean;
}

/** Ordena por relevancia (nombre antes que ingredientes), con la popularidad como desempate. */
export const rankFoods = (foods: Food[], tokens: string[], opts: RankOptions = {}): Food[] => {
  const scored: { f: Food; score: number }[] = [];
  for (const f of foods) {
    const words = wordsOf(f.name);
    const brand = normalize(f.brand ?? '');
    let score = 0;
    let misses = 0;
    tokens.forEach((t, idx) => {
      const m = nameMatch(words, t);
      if (idx === opts.hintIndex) {
        score += m >= 0 ? m : 0;
      } else if (m >= 0) {
        score += m;
      } else if (brand.includes(t)) {
        score += 40;
      } else {
        misses++;
        score -= 60;
      }
    });
    if (opts.strict && misses > 0) continue;
    score -= f.name.length * 0.4;
    score += Math.log10(1 + (f.popularity ?? 0)) * 6;
    scored.push({ f, score });
  }
  return scored.sort((a, b) => b.score - a.score).map((s) => s.f);
};
