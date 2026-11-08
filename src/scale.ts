/**
 * A time scale: which days a chart shows, how wide a day is, and the
 * columns of the header. Zoom levels name the column unit; a scale stretches
 * its columns to fill the given width and never makes one narrower than the
 * zoom's minimum, so a long range scrolls instead.
 */
import { fromDay, nextUnit, partsOf, shiftUnits, startOfUnit, toDay, type ISODate, type TimeUnit } from './model/dates'

export type Zoom = 'day' | 'week' | 'month' | 'quarter'

export interface ZoomLevel {
  /** The unit of a column. */
  unit: TimeUnit
  /** The unit of the band above the columns (a quarter over months, say). */
  band: TimeUnit
  /** The narrowest a column may get, in pixels. */
  minColumn: number
  /** How many columns a range around today shows by default. */
  span: number
  /** Columns shown before today's in the default range. */
  lead: number
}

export const ZOOMS: Record<Zoom, ZoomLevel> = {
  day: { unit: 'day', band: 'month', minColumn: 32, span: 28, lead: 3 },
  week: { unit: 'week', band: 'month', minColumn: 72, span: 10, lead: 2 },
  month: { unit: 'month', band: 'quarter', minColumn: 104, span: 6, lead: 2 },
  quarter: { unit: 'quarter', band: 'year', minColumn: 120, span: 6, lead: 1 },
}

export const ZOOM_ORDER: readonly Zoom[] = ['day', 'week', 'month', 'quarter']

export interface ScaleColumn {
  /** First day (day number). */
  start: number
  /** The day after the last one. */
  end: number
  x: number
  width: number
  /** The column opens a band (a new quarter over months, a new month over weeks), or is the first. */
  bandStart: boolean
}

export interface Scale {
  zoom: Zoom
  /** First day shown (day number). */
  from: number
  /** The day after the last one shown. */
  to: number
  dayWidth: number
  width: number
  columns: ScaleColumn[]
  weekStartsOn: number
}

export interface ScaleOptions {
  zoom: Zoom
  /** First day to show; snapped back to the start of its column. */
  from: ISODate
  /** Last day to show; snapped forward to the end of its column. */
  to: ISODate
  /** The width to fill, in pixels; columns never get narrower than the zoom allows. */
  width?: number
  /** Overrides the zoom's minimum column width. */
  minColumn?: number
  /** 0 Sunday … 6 Saturday; Monday by default. */
  weekStartsOn?: number
}

/** Average days in a column of a unit, for sizing. */
const UNIT_DAYS: Record<TimeUnit, number> = { day: 1, week: 7, month: 30.44, quarter: 91.31, year: 365.25 }

export function createScale(options: ScaleOptions): Scale {
  const level = ZOOMS[options.zoom]
  const weekStartsOn = options.weekStartsOn ?? 1
  let fromDay = toDay(options.from)
  let lastDay = toDay(options.to)
  if (lastDay < fromDay) [fromDay, lastDay] = [lastDay, fromDay]
  const from = startOfUnit(fromDay, level.unit, weekStartsOn)
  const to = nextUnit(startOfUnit(lastDay, level.unit, weekStartsOn), level.unit)
  const days = to - from
  const minColumn = options.minColumn ?? level.minColumn
  const dayWidth = Math.max(minColumn / UNIT_DAYS[level.unit], (options.width ?? 0) / days)
  const columns: ScaleColumn[] = []
  let previousBand = Number.NaN
  for (let at = from; at < to; at = nextUnit(at, level.unit)) {
    const end = nextUnit(at, level.unit)
    const band = startOfUnit(at, level.band, weekStartsOn)
    // A week belongs to the month it starts in.
    columns.push({ start: at, end, x: (at - from) * dayWidth, width: (end - at) * dayWidth, bandStart: band !== previousBand })
    previousBand = band
  }
  return { zoom: options.zoom, from, to, dayWidth, width: days * dayWidth, columns, weekStartsOn }
}

/** The x of the start of a day (a day number or an ISO date). */
export function xOf(scale: Scale, day: number | ISODate): number {
  const n = typeof day === 'number' ? day : toDay(day)
  return (n - scale.from) * scale.dayWidth
}

/** The day under an x (the day whose span holds it). */
export function dayAt(scale: Scale, x: number): number {
  return scale.from + Math.floor(x / scale.dayWidth)
}

/** Whole days a horizontal distance stands for, rounded to the nearest day. */
export function snapDays(scale: Pick<Scale, 'dayWidth'>, dx: number): number {
  const days = Math.round(dx / scale.dayWidth)
  return Object.is(days, -0) ? 0 : days
}

/**
 * The default range for a zoom: `lead` columns before today's column and
 * `span` columns in all, widened to take in `extent` when given (padded by
 * one column on each side).
 */
export function rangeFor(zoom: Zoom, today: ISODate, extent?: { from: number; to: number } | null, weekStartsOn = 1): { from: ISODate; to: ISODate } {
  const level = ZOOMS[zoom]
  const t = toDay(today)
  let from = shiftUnits(t, level.unit, -level.lead, weekStartsOn)
  let to = shiftUnits(from, level.unit, level.span, weekStartsOn) - 1
  if (extent) {
    from = Math.min(from, shiftUnits(extent.from, level.unit, -1, weekStartsOn))
    to = Math.max(to, shiftUnits(extent.to, level.unit, 2, weekStartsOn) - 1)
  }
  return { from: fromDay(from), to: fromDay(to) }
}

/** Parts of a column's first day, for labels. */
export function columnParts(column: ScaleColumn): { year: number; month: number; date: number; quarter: number } {
  const p = partsOf(column.start)
  return { year: p.year, month: p.month, date: p.date, quarter: Math.floor(p.month / 3) + 1 }
}
