import { Injectable } from '@angular/core';
import { Food } from './models';

const FIELDS = 'code,product_name,product_name_es,brands,stores,nutriments,serving_quantity';
const BASE = 'https://world.openfoodfacts.org';

interface OffProduct {
  code?: string;
  product_name?: string;
  product_name_es?: string;
  brands?: string;
  stores?: string;
  serving_quantity?: number | string;
  nutriments?: Record<string, number | string | undefined>;
}

const num = (v: unknown): number => {
  const n = typeof v === 'string' ? parseFloat(v) : (v as number);
  return Number.isFinite(n) ? n : 0;
};

/** Convierte un producto de Open Food Facts; devuelve null si no tiene calorías. */
export const mapProduct = (p: OffProduct): Food | null => {
  const n = p.nutriments ?? {};
  let kcal = num(n['energy-kcal_100g']);
  if (!kcal && n['energy_100g']) kcal = num(n['energy_100g']) / 4.184;
  const name = (p.product_name_es || p.product_name || '').trim();
  if (!name || !p.code || !(kcal > 0 || n['energy-kcal_100g'] === 0)) return null;
  const serving = num(p.serving_quantity);
  return {
    id: p.code,
    barcode: p.code,
    name,
    brand: p.brands?.split(',')[0]?.trim() || undefined,
    stores: p.stores || undefined,
    per100: {
      kcal: Math.round(kcal),
      protein: Math.round(num(n['proteins_100g']) * 10) / 10,
      carbs: Math.round(num(n['carbohydrates_100g']) * 10) / 10,
      fat: Math.round(num(n['fat_100g']) * 10) / 10,
    },
    servingG: serving > 0 ? serving : undefined,
    source: 'off',
  };
};

export class OffError extends Error {
  constructor(
    message: string,
    readonly status?: number,
  ) {
    super(message);
  }
}

const sleep = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

/**
 * Open Food Facts devuelve 503/429 de forma intermitente por saturación (y esas respuestas no llevan
 * cabeceras CORS, por lo que el navegador las ve como error de red). Se reintenta con espera creciente.
 */
const fetchRetry = async (url: string, signal?: AbortSignal, attempts = 3): Promise<Response> => {
  let lastStatus: number | undefined;
  for (let i = 0; i < attempts; i++) {
    try {
      const res = await fetch(url, { signal });
      if (res.ok || res.status === 404) return res;
      lastStatus = res.status;
      if (res.status < 500 && res.status !== 429) break;
    } catch (e) {
      if ((e as Error).name === 'AbortError') throw e;
    }
    if (i < attempts - 1) await sleep(500 * (i + 1) ** 2);
  }
  if (typeof navigator !== 'undefined' && navigator.onLine === false) {
    throw new OffError('Sin conexión a Internet.');
  }
  throw new OffError(
    'Open Food Facts está saturado o no responde ahora mismo. Inténtalo de nuevo en unos segundos.',
    lastStatus,
  );
};

@Injectable({ providedIn: 'root' })
export class OffService {
  private readonly cache = new Map<string, Food[]>();

  async search(term: string, signal?: AbortSignal): Promise<Food[]> {
    const key = term.trim().toLowerCase();
    const hit = this.cache.get(key);
    if (hit) return hit;
    const params = new URLSearchParams({
      search_terms: term,
      search_simple: '1',
      action: 'process',
      json: '1',
      page_size: '30',
      fields: FIELDS,
      tagtype_0: 'countries',
      tag_contains_0: 'contains',
      tag_0: 'spain',
    });
    const res = await fetchRetry(`${BASE}/cgi/search.pl?${params}`, signal);
    const json = (await res.json()) as { products?: OffProduct[] };
    const foods = (json.products ?? []).map(mapProduct).filter((f): f is Food => f !== null);
    this.cache.set(key, foods);
    return foods;
  }

  async byBarcode(code: string): Promise<Food | null> {
    const res = await fetchRetry(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
    if (res.status === 404) return null;
    const json = (await res.json()) as { status?: number; product?: OffProduct };
    if (json.status !== 1 || !json.product) return null;
    return mapProduct({ ...json.product, code: json.product.code ?? code });
  }
}
