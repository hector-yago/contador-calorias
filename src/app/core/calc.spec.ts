import { describe, expect, it } from 'vitest';
import { baseDaily, bmr, dayTargets, macroGoals, mealTargets, scaleMacros, sumMacros, targetForDate, warnings } from './calc';
import { Profile } from './models';
import { defaultProfile } from './store';

const profile = (over: Partial<Profile> = {}): Profile => ({ ...defaultProfile(), ...over });

describe('calc', () => {
  it('bmr Mifflin-St Jeor', () => {
    expect(bmr('H', 30, 175, 80)).toBeCloseTo(1748.75, 2);
    expect(bmr('M', 30, 165, 60)).toBeCloseTo(1320.25, 2);
  });

  it('objetivo base: mantenimiento y déficit semanal', () => {
    const p = profile({ sex: 'H', age: 30, heightCm: 175, activity: 'medio', weeklyGoalKg: -0.5 });
    // 1748.75 × 1.55 = 2710.56 ; −0.5 kg × 7700 / 7 = −550
    expect(baseDaily(p, 80)).toBe(2161);
    expect(baseDaily({ ...p, weeklyGoalKg: 0 }, 80)).toBe(2711);
  });

  it('sin días altos todos los días son iguales', () => {
    const t = dayTargets(profile({ highDays: [] }), 80);
    expect(new Set(t.byDay).size).toBe(1);
  });

  it('días altos suman extra y la semana conserva el total', () => {
    const p = profile({ highDays: [5, 6, 0], highDayPct: 20 });
    const t = dayTargets(p, 80);
    expect(t.high).toBeGreaterThan(t.base);
    expect(t.normal).toBeLessThan(t.base);
    const weekly = t.byDay.reduce((a, b) => a + b, 0);
    expect(Math.abs(weekly - t.base * 7)).toBeLessThanOrEqual(4); // redondeos
  });

  it('targetForDate usa el día de la semana', () => {
    const p = profile({ highDays: [6], highDayPct: 25 });
    const t = dayTargets(p, 80);
    expect(targetForDate(p, 80, '2026-11-07')).toBe(t.high); // sábado
    expect(targetForDate(p, 80, '2026-11-09')).toBe(t.normal); // lunes
  });

  it('reparto por comida normalizado al 100 %', () => {
    const p = profile({ meals: ['desayuno', 'cena'], mealPct: { ...defaultProfile().mealPct, desayuno: 30, cena: 30 } });
    const m = mealTargets(p, 2000);
    expect(m.desayuno).toBe(1000);
    expect(m.cena).toBe(1000);
    expect(m.comida).toBeUndefined();
  });

  it('macros objetivo coherentes con las kcal', () => {
    const g = macroGoals(80, 2000);
    expect(g.protein).toBe(144);
    expect(g.protein * 4 + g.carbs * 4 + g.fat * 9).toBeLessThanOrEqual(2010);
  });

  it('scale y sum de macros', () => {
    const s = scaleMacros({ kcal: 400, protein: 10, carbs: 50, fat: 20 }, 50);
    expect(s).toEqual({ kcal: 200, protein: 5, carbs: 25, fat: 10 });
    expect(sumMacros([s, s]).kcal).toBe(400);
  });

  it('avisos de objetivo agresivo', () => {
    const w = warnings(profile({ weeklyGoalKg: -1.2, sex: 'M', age: 50, heightCm: 155, activity: 'bajo' }), 60);
    expect(w.length).toBe(2);
    expect(warnings(profile({ weeklyGoalKg: -0.25 }), 90)).toEqual([]);
  });
});
