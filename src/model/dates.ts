/**
 * Calendar days as whole numbers: a day is the count of days since
 * 1970-01-01 in UTC, so arithmetic never meets time zones or daylight
 * saving. Dates come and go as ISO strings, `YYYY-MM-DD`.
 */

/** An ISO calendar date, `YYYY-MM-DD`. */
export type ISODate = string

const MS_PER_DAY = 86_400_000
const ISO = /^(\d{4})-(\d{2})-(\d{2})$/

/** Whether the string is a real calendar date in `YYYY-MM-DD` form. */
export function isISODate(value: unknown): value is ISODate {
  if (typeof value !== 'string') return false
  const m = ISO.exec(value)
  if (!m) return false
  const [y, mo, d] = [Number(m[1]), Number(m[2]), Number(m[3])]
  const date = new Date(Date.UTC(y, mo - 1, d))
  return date.getUTCFullYear() === y && date.getUTCMonth() === mo - 1 && date.getUTCDate() === d
}

/** The day number of an ISO date. Throws on anything else. */
export function toDay(date: ISODate): number {
  if (!isISODate(date)) throw new RangeError(`Not an ISO date: ${String(date)}`)
  const [y, m, d] = date.split('-').map(Number) as [number, number, number]
  return Math.round(Date.UTC(y, m - 1, d) / MS_PER_DAY)
}

/** The ISO date of a day number. */
export function fromDay(day: number): ISODate {
  return new Date(Math.round(day) * MS_PER_DAY).toISOString().slice(0, 10)
}

export function addDays(date: ISODate, days: number): ISODate {
  return fromDay(toDay(date) + days)
}

/** Whole days from `a` to `b` (negative when `b` is earlier). */
export function diffDays(a: ISODate, b: ISODate): number {
  return toDay(b) - toDay(a)
}

/** Today in the local time zone of `now` (the viewer's calendar day). */
export function todayISO(now: Date = new Date()): ISODate {
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
}

/** Parts of a day number: year, month 0–11, day of month 1–31, weekday 0 (Sunday)–6. */
export function partsOf(day: number): { year: number; month: number; date: number; weekday: number } {
  const d = new Date(day * MS_PER_DAY)
  return { year: d.getUTCFullYear(), month: d.getUTCMonth(), date: d.getUTCDate(), weekday: d.getUTCDay() }
}

/** The day number of the first of a month; months past 11 or below 0 roll the year. */
export function monthStart(year: number, month: number): number {
  return Math.round(Date.UTC(year, month, 1) / MS_PER_DAY)
}

/** The units a time scale divides into. */
export type TimeUnit = 'day' | 'week' | 'month' | 'quarter' | 'year'

/**
 * The first day of the unit holding `day`. Weeks start on
 * `weekStartsOn` (0 Sunday … 6 Saturday; Monday by default).
 */
export function startOfUnit(day: number, unit: TimeUnit, weekStartsOn = 1): number {
  const p = partsOf(day)
  switch (unit) {
    case 'day':
      return day
    case 'week':
      return day - ((p.weekday - weekStartsOn + 7) % 7)
    case 'month':
      return monthStart(p.year, p.month)
    case 'quarter':
      return monthStart(p.year, p.month - (p.month % 3))
    case 'year':
      return monthStart(p.year, 0)
  }
}

/** The first day of the unit after the one starting on `start`. */
export function nextUnit(start: number, unit: TimeUnit): number {
  const p = partsOf(start)
  switch (unit) {
    case 'day':
      return start + 1
    case 'week':
      return start + 7
    case 'month':
      return monthStart(p.year, p.month + 1)
    case 'quarter':
      return monthStart(p.year, p.month + 3)
    case 'year':
      return monthStart(p.year + 1, 0)
  }
}

/** `count` units later (or earlier, when negative), from the unit start holding `day`. */
export function shiftUnits(day: number, unit: TimeUnit, count: number, weekStartsOn = 1): number {
  let at = startOfUnit(day, unit, weekStartsOn)
  if (count >= 0) {
    for (let i = 0; i < count; i++) at = nextUnit(at, unit)
    return at
  }
  for (let i = 0; i < -count; i++) at = startOfUnit(at - 1, unit, weekStartsOn)
  return at
}
