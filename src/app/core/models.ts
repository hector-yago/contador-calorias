export type MealId = 'desayuno' | 'media-manana' | 'comida' | 'merienda' | 'cena' | 'picoteo';
export type Sex = 'H' | 'M';
export type Activity = 'bajo' | 'medio' | 'alto';

export const MEALS: { id: MealId; label: string }[] = [
  { id: 'desayuno', label: 'Desayuno' },
  { id: 'media-manana', label: 'Media mañana' },
  { id: 'comida', label: 'Comida' },
  { id: 'merienda', label: 'Merienda' },
  { id: 'cena', label: 'Cena' },
  { id: 'picoteo', label: 'Picoteo' },
];

export const mealLabel = (id: MealId): string => MEALS.find((m) => m.id === id)?.label ?? id;

export interface Macros {
  kcal: number;
  protein: number;
  carbs: number;
  fat: number;
}

export interface Profile {
  id: 'me';
  configured: boolean;
  sex: Sex;
  age: number;
  heightCm: number;
  activity: Activity;
  /** kg por semana; negativo = perder peso. */
  weeklyGoalKg: number;
  meals: MealId[];
  /** Porcentaje de las calorías del día por comida (se normaliza entre las activas). */
  mealPct: Record<MealId, number>;
  /** Días con más calorías (0 = domingo … 6 = sábado, como Date.getDay()). */
  highDays: number[];
  /** Porcentaje extra de los días altos sobre el objetivo base. */
  highDayPct: number;
}

export interface Food {
  id: string;
  barcode?: string;
  name: string;
  brand?: string;
  stores?: string;
  /** Valores por 100 g (o 100 ml). */
  per100: Macros;
  servingG?: number;
  /** Escaneos en Open Food Facts: sirve para ordenar por popularidad. */
  popularity?: number;
  source: 'off' | 'manual';
  lastUsed?: number;
  useCount?: number;
}

export interface Entry extends Macros {
  id?: number;
  date: string;
  meal: MealId;
  name: string;
  brand?: string;
  foodId?: string;
  grams: number;
  /** Valores por 100 g del momento del registro (permite editar los gramos). */
  per100?: Macros;
}

export interface MealItem {
  foodId?: string;
  name: string;
  brand?: string;
  grams: number;
  per100: Macros;
}

export interface CustomMeal {
  id?: number;
  name: string;
  items: MealItem[];
}

export interface WeightEntry {
  date: string;
  kg: number;
}

export interface BackupFile {
  app: 'contador-calorias';
  version: 1;
  exportedAt: string;
  profile: Profile | null;
  weights: WeightEntry[];
  foods: Food[];
  entries: Entry[];
  meals: CustomMeal[];
}
