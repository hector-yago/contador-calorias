import { Activity, Macros, MealId, Profile, Sex } from './models';
import { dayOfWeek } from './dates';

export const ACTIVITY_FACTOR: Record<Activity, number> = { bajo: 1.375, medio: 1.55, alto: 1.725 };
export const KCAL_PER_KG = 7700;

/** Metabolismo basal, Mifflin-St Jeor. */
export const bmr = (sex: Sex, age: number, heightCm: number, kg: number): number =>
  10 * kg + 6.25 * heightCm - 5 * age + (sex === 'H' ? 5 : -161);

export const maintenance = (p: Profile, kg: number): number =>
  bmr(p.sex, p.age, p.heightCm, kg) * ACTIVITY_FACTOR[p.activity];

/** Objetivo diario base (sin distinguir días altos). */
export const baseDaily = (p: Profile, kg: number): number =>
  Math.round(maintenance(p, kg) + (p.weeklyGoalKg * KCAL_PER_KG) / 7);

export interface DayTargets {
  base: number;
  normal: number;
  high: number;
  /** Objetivo por día de la semana (índice = Date.getDay()). */
  byDay: number[];
}

/** Los días altos suman extra y el resto baja para que la semana mantenga el mismo total. */
export const dayTargets = (p: Profile, kg: number): DayTargets => {
  const base = baseDaily(p, kg);
  const highs = [...new Set(p.highDays)].filter((d) => d >= 0 && d <= 6);
  if (highs.length === 0 || highs.length === 7 || p.highDayPct <= 0) {
    return { base, normal: base, high: base, byDay: Array<number>(7).fill(base) };
  }
  const high = Math.round(base * (1 + p.highDayPct / 100));
  const normal = Math.round((base * 7 - highs.length * high) / (7 - highs.length));
  const byDay = Array.from({ length: 7 }, (_, d) => (highs.includes(d) ? high : normal));
  return { base, normal, high, byDay };
};

export const targetForDate = (p: Profile, kg: number, iso: string): number =>
  dayTargets(p, kg).byDay[dayOfWeek(iso)];

/** Reparto del objetivo del día entre las comidas activas, normalizado a 100 %. */
export const mealTargets = (p: Profile, dayKcal: number): Partial<Record<MealId, number>> => {
  const total = p.meals.reduce((s, m) => s + (p.mealPct[m] ?? 0), 0);
  const out: Partial<Record<MealId, number>> = {};
  for (const m of p.meals) {
    out[m] =
      total > 0
        ? Math.round((dayKcal * (p.mealPct[m] ?? 0)) / total)
        : Math.round(dayKcal / p.meals.length);
  }
  return out;
};

export const macroGoals = (kg: number, dayKcal: number): Omit<Macros, 'kcal'> => {
  const protein = Math.round(1.8 * kg);
  const fat = Math.round((0.25 * dayKcal) / 9);
  const carbs = Math.max(0, Math.round((dayKcal - protein * 4 - fat * 9) / 4));
  return { protein, carbs, fat };
};

export const zeroMacros = (): Macros => ({ kcal: 0, protein: 0, carbs: 0, fat: 0 });

export const sumMacros = (items: Macros[]): Macros =>
  items.reduce(
    (a, i) => ({
      kcal: a.kcal + i.kcal,
      protein: a.protein + i.protein,
      carbs: a.carbs + i.carbs,
      fat: a.fat + i.fat,
    }),
    zeroMacros(),
  );

export const scaleMacros = (per100: Macros, grams: number): Macros => ({
  kcal: (per100.kcal * grams) / 100,
  protein: (per100.protein * grams) / 100,
  carbs: (per100.carbs * grams) / 100,
  fat: (per100.fat * grams) / 100,
});

export const warnings = (p: Profile, kg: number): string[] => {
  const out: string[] = [];
  const floor = p.sex === 'H' ? 1500 : 1200;
  const t = dayTargets(p, kg);
  if (Math.min(t.normal, t.base) < floor) {
    out.push(`El objetivo diario baja de ${floor} kcal, por debajo de lo habitual sin supervisión médica.`);
  }
  if (p.weeklyGoalKg < 0 && Math.abs(p.weeklyGoalKg) > kg * 0.01) {
    out.push('Perder más del 1 % del peso por semana es un ritmo agresivo.');
  }
  return out;
};

export const round1 = (n: number): number => Math.round(n * 10) / 10;
