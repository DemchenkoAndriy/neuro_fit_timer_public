export const WEEKDAY_SHORT = ['пн', 'вт', 'ср', 'чт', 'пт', 'сб', 'нд'];
export const WEEKDAY_LONG = [
  'Понеділок',
  'Вівторок',
  'Середа',
  'Четвер',
  "П'ятниця",
  'Субота',
  'Неділя',
];

/** ISO weekday: 1 = понеділок … 7 = неділя. */
export function isoWeekday(date: Date): number {
  return date.getDay() === 0 ? 7 : date.getDay();
}

export function toISODate(date: Date): string {
  const y = date.getFullYear();
  const m = `${date.getMonth() + 1}`.padStart(2, '0');
  const d = `${date.getDate()}`.padStart(2, '0');
  return `${y}-${m}-${d}`;
}

export function fromISODate(iso: string): Date {
  const [y, m, d] = iso.split('-').map(Number);
  return new Date(y, m - 1, d);
}

export function addDays(date: Date, days: number): Date {
  const next = new Date(date);
  next.setDate(next.getDate() + days);
  return next;
}

/** Monday of the week the given date falls in. */
export function startOfWeek(date: Date): Date {
  const monday = addDays(date, -(isoWeekday(date) - 1));
  monday.setHours(0, 0, 0, 0);
  return monday;
}

export function daysBetween(from: Date, to: Date): number {
  const a = new Date(from);
  const b = new Date(to);
  a.setHours(12, 0, 0, 0);
  b.setHours(12, 0, 0, 0);
  return Math.round((b.getTime() - a.getTime()) / 86_400_000);
}

export function isSameDay(a: Date, b: Date): boolean {
  return toISODate(a) === toISODate(b);
}

/** "Понеділок 7.09.2026" — the format used on the home screen. */
export function formatLongDate(date: Date): string {
  const weekday = WEEKDAY_LONG[isoWeekday(date) - 1];
  const day = date.getDate();
  const month = `${date.getMonth() + 1}`.padStart(2, '0');
  return `${weekday} ${day}.${month}.${date.getFullYear()}`;
}

/** "7 вересня" */
const MONTHS_GENITIVE = [
  'січня',
  'лютого',
  'березня',
  'квітня',
  'травня',
  'червня',
  'липня',
  'серпня',
  'вересня',
  'жовтня',
  'листопада',
  'грудня',
];

export function formatDayMonth(date: Date): string {
  return `${date.getDate()} ${MONTHS_GENITIVE[date.getMonth()]}`;
}

/** Epoch ms → "18:32" — the wall-clock time a workout started or ended. */
export function formatTime(epochMs: number): string {
  const date = new Date(epochMs);
  const hours = `${date.getHours()}`.padStart(2, '0');
  const minutes = `${date.getMinutes()}`.padStart(2, '0');
  return `${hours}:${minutes}`;
}

/** Seconds → "05:30" (or "1:05:30" past an hour). */
export function formatClock(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds));
  const hours = Math.floor(s / 3600);
  const minutes = Math.floor((s % 3600) / 60);
  const seconds = s % 60;
  const mm = `${minutes}`.padStart(2, '0');
  const ss = `${seconds}`.padStart(2, '0');
  return hours > 0 ? `${hours}:${mm}:${ss}` : `${mm}:${ss}`;
}

/** Seconds → "45 с" / "42 хв" / "1 год 05 хв". */
export function formatDuration(totalSeconds: number): string {
  if (totalSeconds < 60) return `${Math.max(0, Math.round(totalSeconds))} с`;
  const minutes = Math.round(totalSeconds / 60);
  if (minutes < 60) return `${minutes} хв`;
  const h = Math.floor(minutes / 60);
  const m = `${minutes % 60}`.padStart(2, '0');
  return `${h} год ${m} хв`;
}
