import { Injectable, computed, signal } from '@angular/core';
import { AppDb } from './db';
import { scaleMacros } from './calc';
import { rankFoods, tokenize } from './search-rank';
import { todayIso } from './dates';
import {
  BackupFile,
  CustomMeal,
  Entry,
  Food,
  Macros,
  MealId,
  MealItem,
  Profile,
  WeightEntry,
} from './models';

export const defaultProfile = (): Profile => ({
  id: 'me',
  configured: false,
  sex: 'H',
  age: 30,
  heightCm: 175,
  activity: 'medio',
  weeklyGoalKg: -0.5,
  meals: ['desayuno', 'comida', 'merienda', 'cena'],
  mealPct: { desayuno: 25, 'media-manana': 10, comida: 35, merienda: 10, cena: 25, picoteo: 5 },
  highDays: [],
  highDayPct: 15,
});

const uuid = (): string =>
  typeof crypto !== 'undefined' && 'randomUUID' in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

@Injectable({ providedIn: 'root' })
export class Store {
  readonly db = new AppDb();

  readonly profile = signal<Profile>(defaultProfile());
  readonly weights = signal<WeightEntry[]>([]);
  /** Se incrementa con cada cambio de datos para que las pantallas recarguen. */
  readonly rev = signal(0);
  /** Día seleccionado en Diario/Resumen. */
  readonly selectedDate = signal(todayIso());
  readonly persisted = signal<boolean | null>(null);

  readonly latestKg = computed(() => {
    const w = this.weights();
    return w.length ? w[w.length - 1].kg : null;
  });

  async init(): Promise<void> {
    const stored = await this.db.profile.get('me');
    if (stored) this.profile.set({ ...defaultProfile(), ...stored });
    await this.loadWeights();
    try {
      if (navigator.storage?.persist) this.persisted.set(await navigator.storage.persist());
    } catch {
      this.persisted.set(null);
    }
  }

  private bump(): void {
    this.rev.update((v) => v + 1);
  }

  private async loadWeights(): Promise<void> {
    this.weights.set(await this.db.weights.orderBy('date').toArray());
  }

  async saveProfile(p: Profile): Promise<void> {
    const next = { ...p, id: 'me' as const, configured: true };
    await this.db.profile.put(next);
    this.profile.set(next);
    this.bump();
  }

  async setWeight(kg: number, date = todayIso()): Promise<void> {
    await this.db.weights.put({ date, kg });
    await this.loadWeights();
    this.bump();
  }

  async deleteWeight(date: string): Promise<void> {
    await this.db.weights.delete(date);
    await this.loadWeights();
    this.bump();
  }

  // ---- Diario ----

  entriesBetween(from: string, to: string): Promise<Entry[]> {
    return this.db.entries.where('date').between(from, to, true, true).toArray();
  }

  async addFoodEntry(date: string, meal: MealId, food: Food, grams: number): Promise<void> {
    const m = scaleMacros(food.per100, grams);
    await this.db.entries.add({
      date,
      meal,
      name: food.name,
      brand: food.brand,
      foodId: food.id,
      grams,
      per100: food.per100,
      ...m,
    });
    await this.touchFood(food);
    this.bump();
  }

  async addItemsAsEntries(date: string, meal: MealId, items: MealItem[]): Promise<void> {
    await this.db.entries.bulkAdd(
      items.map((i) => ({
        date,
        meal,
        name: i.name,
        brand: i.brand,
        foodId: i.foodId,
        grams: i.grams,
        per100: i.per100,
        ...scaleMacros(i.per100, i.grams),
      })),
    );
    this.bump();
  }

  async addQuickCalories(date: string, meal: MealId, name: string, macros: Macros): Promise<void> {
    await this.db.entries.add({ date, meal, name: name || 'Calorías rápidas', grams: 0, ...macros });
    this.bump();
  }

  async updateEntryGrams(entry: Entry, grams: number): Promise<void> {
    if (!entry.id || !entry.per100) return;
    await this.db.entries.update(entry.id, { grams, ...scaleMacros(entry.per100, grams) });
    this.bump();
  }

  async deleteEntry(id: number): Promise<void> {
    await this.db.entries.delete(id);
    this.bump();
  }

  async copyMeal(fromDate: string, toDate: string, meal: MealId): Promise<number> {
    const src = (await this.entriesBetween(fromDate, fromDate)).filter((e) => e.meal === meal);
    await this.db.entries.bulkAdd(src.map(({ id: _id, ...rest }) => ({ ...rest, date: toDate })));
    this.bump();
    return src.length;
  }

  // ---- Alimentos ----

  async saveFood(food: Omit<Food, 'id'> & { id?: string }): Promise<Food> {
    const saved: Food = { ...food, id: food.id ?? food.barcode ?? uuid() };
    await this.db.foods.put(saved);
    return saved;
  }

  private async touchFood(food: Food): Promise<void> {
    const existing = await this.db.foods.get(food.id);
    await this.db.foods.put({
      ...food,
      lastUsed: Date.now(),
      useCount: (existing?.useCount ?? 0) + 1,
    });
  }

  recentFoods(limit = 20): Promise<Food[]> {
    return this.db.foods.orderBy('lastUsed').reverse().filter((f) => !!f.lastUsed).limit(limit).toArray();
  }

  async searchLocalFoods(term: string): Promise<Food[]> {
    const tokens = tokenize(term);
    if (!tokens.length) return [];
    return rankFoods(await this.db.foods.toArray(), tokens, { strict: true }).slice(0, 20);
  }

  findFoodByBarcode(code: string): Promise<Food | undefined> {
    return this.db.foods.where('barcode').equals(code).first();
  }

  // ---- Comidas habituales ----

  listMeals(): Promise<CustomMeal[]> {
    return this.db.meals.orderBy('name').toArray();
  }

  getMeal(id: number): Promise<CustomMeal | undefined> {
    return this.db.meals.get(id);
  }

  async saveMeal(meal: CustomMeal): Promise<number> {
    const id = (await this.db.meals.put(meal)) as number;
    this.bump();
    return id;
  }

  async deleteMeal(id: number): Promise<void> {
    await this.db.meals.delete(id);
    this.bump();
  }

  // ---- Copia de seguridad ----

  async exportAll(): Promise<BackupFile> {
    return {
      app: 'contador-calorias',
      version: 1,
      exportedAt: new Date().toISOString(),
      profile: (await this.db.profile.get('me')) ?? null,
      weights: await this.db.weights.toArray(),
      foods: await this.db.foods.toArray(),
      entries: await this.db.entries.toArray(),
      meals: await this.db.meals.toArray(),
    };
  }

  /** Sustituye todos los datos por los de la copia. Valida la estructura antes de borrar nada. */
  async importAll(data: unknown): Promise<void> {
    const b = data as Partial<BackupFile>;
    if (
      !b ||
      b.app !== 'contador-calorias' ||
      b.version !== 1 ||
      !Array.isArray(b.weights) ||
      !Array.isArray(b.foods) ||
      !Array.isArray(b.entries) ||
      !Array.isArray(b.meals)
    ) {
      throw new Error('El archivo no es una copia válida de Contador de calorías.');
    }
    const db = this.db;
    await db.transaction('rw', [db.profile, db.weights, db.foods, db.entries, db.meals], async () => {
      await Promise.all([db.profile.clear(), db.weights.clear(), db.foods.clear(), db.entries.clear(), db.meals.clear()]);
      if (b.profile) await db.profile.put(b.profile);
      await db.weights.bulkPut(b.weights!);
      await db.foods.bulkPut(b.foods!);
      await db.entries.bulkAdd(b.entries!);
      await db.meals.bulkAdd(b.meals!);
    });
    await this.init();
    this.bump();
  }
}
