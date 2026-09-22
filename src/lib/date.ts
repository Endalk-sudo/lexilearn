/**
 * Local-calendar date helpers.
 *
 * Why this exists: `Date#toISOString()` converts to UTC before slicing, so
 * `new Date().toISOString().slice(0, 10)` reports *yesterday* for anyone east
 * of Greenwich in the early hours and *tomorrow* for anyone west of it late in
 * the day. Every day-key in the app must be derived from the user's local
 * calendar instead, otherwise streaks, "learned today" and the contribution
 * calendar all drift by a day for most of the world.
 */

/** Local day key in `YYYY-MM-DD` form. */
export function dayKey(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

/** Parse a `YYYY-MM-DD` key back into a Date at local midnight. */
export function parseDayKey(key: string): Date {
  const [y, m, d] = key.split('-').map(Number)
  return new Date(y, (m ?? 1) - 1, d ?? 1)
}

/** Local midnight of the given date. */
export function startOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(0, 0, 0, 0)
  return d
}

/** Local end-of-day (23:59:59.999) of the given date. */
export function endOfDay(date: Date): Date {
  const d = new Date(date)
  d.setHours(23, 59, 59, 999)
  return d
}

/** Add (or subtract) whole days, staying on local midnight. */
export function addDays(date: Date, days: number): Date {
  const d = startOfDay(date)
  d.setDate(d.getDate() + days)
  return d
}

/** Inclusive list of day keys between two dates. */
export function dayKeysBetween(from: Date, to: Date): string[] {
  const keys: string[] = []
  for (let d = startOfDay(from); d <= to; d = addDays(d, 1)) keys.push(dayKey(d))
  return keys
}

/** Today's local day key. */
export function todayKey(): string {
  return dayKey(new Date())
}
