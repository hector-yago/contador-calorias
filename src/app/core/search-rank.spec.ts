import { describe, expect, it } from 'vitest';
import { Food } from './models';
import { findCategoryHint, rankFoods, tokenize } from './search-rank';

const food = (name: string, popularity = 10, brand?: string): Food => ({
  id: name + (brand ?? ''),
  name,
  brand,
  per100: { kcal: 50, protein: 3, carbs: 5, fat: 2 },
  popularity,
  source: 'off',
});

describe('search-rank', () => {
  it('tokeniza sin tildes ni mayúsculas', () => {
    expect(tokenize('Leche  DESNATÁ')).toEqual(['leche', 'desnata']);
  });

  it('detecta la categoría de alimentos básicos, incluso en plural o a medias', () => {
    expect(findCategoryHint(['leche'])).toEqual({ tag: 'en:milks', index: 0 });
    expect(findCategoryHint(['yogures'])?.tag).toBe('en:yogurts');
    expect(findCategoryHint(['lech'])?.tag).toBe('en:milks');
    expect(findCategoryHint(['desnat', 'leche'])).toEqual({ tag: 'en:milks', index: 1 });
    expect(findCategoryHint(['galletas', 'maria'])?.tag).toBe('en:biscuits');
    expect(findCategoryHint(['xyz'])).toBeNull();
    expect(findCategoryHint(['pa'])).toBeNull();
  });

  it('una palabra a medias coincide por prefijo (desnat → desnatada)', () => {
    const list = [food('Leche desnatada'), food('Kéfir natural'), food('Bifidus desnat maduixa')];
    const r = rankFoods(list, tokenize('leche desnat'), { hintIndex: 0, strict: true });
    // "Kéfir natural" no contiene "desnat…" y se descarta; la que dice "leche" va primero.
    expect(r.map((f) => f.name)).toEqual(['Leche desnatada', 'Bifidus desnat maduixa']);
  });

  it('las leches van antes que productos que solo mencionan leche', () => {
    const list = [
      food('Chocolate con leche y almendras', 176),
      food('Queso cremoso con leche', 181),
      food('Leche entera', 20, 'Mercadona'),
      food('Leche semidesnatada', 30),
    ];
    const r = rankFoods(list, ['leche'], { hintIndex: 0 });
    expect(r.slice(0, 2).map((f) => f.name).sort()).toEqual(['Leche entera', 'Leche semidesnatada']);
  });

  it('modo estricto descarta lo que no encaja y usa la marca si hace falta', () => {
    const list = [food('Leche entera', 5, 'Hacendado'), food('Leche entera', 50, 'Pascual')];
    const r = rankFoods(list, tokenize('leche hacendado'), { strict: true });
    expect(r).toHaveLength(2 - 1);
    expect(r[0].brand).toBe('Hacendado');
  });
});
