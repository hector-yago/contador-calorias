import { Injectable } from '@angular/core';
import { Food } from './models';

export const STORES = [
  'Mercadona',
  'Lidl',
  'Dia',
  'Aldi',
  'Carrefour',
  'Alcampo',
  'Ahorramas',
  'Hipercor',
  'Family Cash',
];

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

const slug = (s: string): string =>
  s
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-|-$/g, '');

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

@Injectable({ providedIn: 'root' })
export class OffService {
  async search(term: string, store?: string): Promise<Food[]> {
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
    if (store) {
      params.set('tagtype_1', 'stores');
      params.set('tag_contains_1', 'contains');
      params.set('tag_1', slug(store));
    }
    const res = await fetch(`${BASE}/cgi/search.pl?${params}`);
    if (!res.ok) throw new Error(`Open Food Facts respondió ${res.status}`);
    const json = (await res.json()) as { products?: OffProduct[] };
    return (json.products ?? []).map(mapProduct).filter((f): f is Food => f !== null);
  }

  async byBarcode(code: string): Promise<Food | null> {
    const res = await fetch(`${BASE}/api/v2/product/${encodeURIComponent(code)}.json?fields=${FIELDS}`);
    if (res.status === 404) return null;
    if (!res.ok) throw new Error(`Open Food Facts respondió ${res.status}`);
    const json = (await res.json()) as { status?: number; product?: OffProduct };
    if (json.status !== 1 || !json.product) return null;
    return mapProduct({ ...json.product, code: json.product.code ?? code });
  }
}
