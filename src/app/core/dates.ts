const pad = (n: number): string => String(n).padStart(2, '0');

export const toIso = (d: Date): string => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

export const fromIso = (iso: string): Date => {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
};

export const todayIso = (): string => toIso(new Date());

export const addDays = (iso: string, n: number): string => {
  const d = fromIso(iso);
  d.setDate(d.getDate() + n);
  return toIso(d);
};

/** Lunes de la semana que contiene la fecha. */
export const mondayOf = (iso: string): string => {
  const back = (fromIso(iso).getDay() + 6) % 7;
  return addDays(iso, -back);
};

export const weekDays = (iso: string): string[] => {
  const monday = mondayOf(iso);
  return Array.from({ length: 7 }, (_, i) => addDays(monday, i));
};

export const dayOfWeek = (iso: string): number => fromIso(iso).getDay();

export const formatDayLabel = (iso: string): string => {
  const today = todayIso();
  if (iso === today) return 'Hoy';
  if (iso === addDays(today, -1)) return 'Ayer';
  if (iso === addDays(today, 1)) return 'Mañana';
  return fromIso(iso).toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' });
};

export const WEEKDAY_SHORT = ['D', 'L', 'M', 'X', 'J', 'V', 'S'];
export const WEEKDAY_NAMES = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
