/**
 * The model of a chart: rows (plain rows and group headers) holding bars
 * and milestones, and links between bars. Plain JSON: the host owns it and
 * passes it in; the chart reports what a person changed and never edits the
 * host's data itself.
 */
import type { ISODate } from './dates'

/** A colour role; the components map it to the kit's tokens. */
export type Tone = 'accent' | 'success' | 'warning' | 'danger' | 'info' | 'neutral' | 'muted'

export const TONES: readonly Tone[] = ['accent', 'success', 'warning', 'danger', 'info', 'neutral', 'muted']

/** A span of time on a row: from its first day to its last day, both included. */
export interface GanttBar {
  id: string
  /** The first day. */
  start: ISODate
  /** The last day (inclusive): a one-day bar has `end === start`. */
  end: ISODate
  /** Share done, 0–1; drawn as a fill from the start. */
  progress?: number
  tone?: Tone
  /** The dates are an estimate: drawn dashed, without a fill. */
  estimate?: boolean
  /** Text inside or beside the bar. */
  label?: string
  /** What a screen reader says for the bar; the label and the dates when absent. */
  ariaLabel?: string
  /** Not draggable, even in an editable chart. */
  locked?: boolean
}

/** A single date on a row: a release, a deadline. */
export interface GanttMilestone {
  id: string
  date: ISODate
  label?: string
  tone?: Tone
  ariaLabel?: string
  locked?: boolean
}

export type RowKind = 'row' | 'group'

export interface GanttRow {
  id: string
  /** `group`: a header row that spans the table; it may still hold milestones and bars. */
  kind?: RowKind
  /** The row's name: the main cell, and what the bars of the row are announced with. */
  label: string
  /** Values for the table's columns, by column key; rendered as text unless the host gives a slot. */
  cells?: Record<string, string | number | null | undefined>
  bars?: GanttBar[]
  milestones?: GanttMilestone[]
}

/** "`to` follows `from`": an arrow from the end of one bar to the start of the other. */
export interface GanttLink {
  id: string
  from: string
  to: string
  locked?: boolean
}

export interface GanttModel {
  rows: GanttRow[]
  links?: GanttLink[]
}

/** A bar or a milestone with the row it sits on. */
export interface Located<T> {
  item: T
  row: GanttRow
  rowIndex: number
}
