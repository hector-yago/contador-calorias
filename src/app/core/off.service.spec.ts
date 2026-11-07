import { describe, expect, it } from 'vitest';
import { mapProduct } from './off.service';

describe('mapProduct', () => {
  it('convierte un producto de Open Food Facts', () => {
    const f = mapProduct({
      code: '8480000123456',
      product_name: 'Leche entera',
      brands: 'Hacendado, Otra',
      stores: 'Mercadona',
      serving_quantity: '250',
      nutriments: { 'energy-kcal_100g': 63, proteins_100g: '3.1', carbohydrates_100g: 4.7, fat_100g: 3.6 },
    });
    expect(f).toMatchObject({
      id: '8480000123456',
      brand: 'Hacendado',
      servingG: 250,
      per100: { kcal: 63, protein: 3.1, carbs: 4.7, fat: 3.6 },
    });
  });

  it('usa kJ si faltan kcal y descarta productos sin nombre o sin energía', () => {
    const f = mapProduct({ code: '1', product_name: 'X', nutriments: { energy_100g: 418.4 } });
    expect(f?.per100.kcal).toBe(100);
    expect(mapProduct({ code: '2', nutriments: { 'energy-kcal_100g': 10 } })).toBeNull();
    expect(mapProduct({ code: '3', product_name: 'Y', nutriments: {} })).toBeNull();
  });
});
