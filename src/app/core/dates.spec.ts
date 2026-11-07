import { describe, expect, it } from 'vitest';
import { addDays, mondayOf, toIso, weekDays } from './dates';

describe('dates', () => {
  it('addDays cruza mes y año', () => {
    expect(addDays('2026-12-31', 1)).toBe('2027-01-01');
    expect(addDays('2026-03-01', -1)).toBe('2026-02-28');
  });

  it('mondayOf devuelve el lunes de la semana', () => {
    expect(mondayOf('2026-11-07')).toBe('2026-11-02'); // sábado
    expect(mondayOf('2026-11-08')).toBe('2026-11-02'); // domingo
    expect(mondayOf('2026-11-02')).toBe('2026-11-02');
  });

  it('weekDays tiene 7 días de lunes a domingo', () => {
    const w = weekDays('2026-11-05');
    expect(w).toHaveLength(7);
    expect(w[0]).toBe('2026-11-02');
    expect(w[6]).toBe('2026-11-08');
  });

  it('toIso usa la fecha local', () => {
    expect(toIso(new Date(2026, 0, 5))).toBe('2026-01-05');
  });
});
