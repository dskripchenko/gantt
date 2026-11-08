/**
 * Labels of the header and dates in the chart's language, with `Intl`.
 */
import { columnParts, fromDay, type ScaleColumn, type Zoom } from '../index'
import type { GanttLabels } from './labels'

const capital = (s: string) => (s ? s[0]!.toLocaleUpperCase() + s.slice(1) : s)

/** A month's name as it stands alone (a header), not inside a date. */
export function monthName(lang: string, month: number, style: 'long' | 'short' = 'long'): string {
  // The 15th avoids the edges of the month in any zone.
  return capital(new Intl.DateTimeFormat(lang, { month: style, timeZone: 'UTC' }).format(Date.UTC(2001, month, 15)))
}

export interface HeaderCell {
  /** The band above: a quarter over months, a month over weeks, a year over quarters; empty inside a band. */
  band: string
  label: string
}

export function headerCell(column: ScaleColumn, zoom: Zoom, lang: string, labels: GanttLabels): HeaderCell {
  const p = columnParts(column)
  switch (zoom) {
    case 'day':
      return { band: column.bandStart ? monthName(lang, p.month) : '', label: String(p.date) }
    case 'week':
      return { band: column.bandStart ? monthName(lang, p.month) : '', label: labels.week(p.date) }
    case 'month':
      return { band: column.bandStart ? labels.quarter(p.quarter) : '', label: monthName(lang, p.month) }
    case 'quarter':
      return { band: column.bandStart ? String(p.year) : '', label: labels.quarter(p.quarter) }
  }
}

/** `5 Nov 2026`, or without the year when it is the current one. */
export function formatDate(lang: string, date: string | number, today?: string): string {
  const iso = typeof date === 'number' ? fromDay(date) : date
  const sameYear = today !== undefined && today.slice(0, 4) === iso.slice(0, 4)
  return new Intl.DateTimeFormat(lang, { day: 'numeric', month: 'short', year: sameYear ? undefined : 'numeric', timeZone: 'UTC' }).format(Date.parse(iso))
}
