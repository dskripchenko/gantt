/**
 * Strict reading of a model from untrusted JSON, and lookups over it.
 */
import { isISODate, toDay } from './dates'
import { TONES, type GanttBar, type GanttLink, type GanttMilestone, type GanttModel, type GanttRow, type Located, type Tone } from './types'

export class GanttError extends Error {
  override name = 'GanttError'
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v)
const str = (v: unknown, what: string): string => {
  if (typeof v !== 'string' || v === '') throw new GanttError(`${what} must be a non-empty string`)
  return v
}
const optStr = (v: unknown): string | undefined => (typeof v === 'string' ? v : undefined)
const tone = (v: unknown): Tone | undefined => (TONES.includes(v as Tone) ? (v as Tone) : undefined)

function bar(raw: unknown): GanttBar {
  if (!isObject(raw)) throw new GanttError('A bar must be an object')
  const id = str(raw.id, 'bar.id')
  if (!isISODate(raw.start) || !isISODate(raw.end)) throw new GanttError(`Bar ${id}: start and end must be ISO dates`)
  if (toDay(raw.end) < toDay(raw.start)) throw new GanttError(`Bar ${id}: end is before start`)
  const out: GanttBar = { id, start: raw.start, end: raw.end }
  if (typeof raw.progress === 'number' && Number.isFinite(raw.progress)) out.progress = Math.min(1, Math.max(0, raw.progress))
  if (tone(raw.tone)) out.tone = tone(raw.tone)
  if (raw.estimate === true) out.estimate = true
  if (optStr(raw.label) !== undefined) out.label = optStr(raw.label)
  if (optStr(raw.ariaLabel) !== undefined) out.ariaLabel = optStr(raw.ariaLabel)
  if (raw.locked === true) out.locked = true
  return out
}

function milestone(raw: unknown): GanttMilestone {
  if (!isObject(raw)) throw new GanttError('A milestone must be an object')
  const id = str(raw.id, 'milestone.id')
  if (!isISODate(raw.date)) throw new GanttError(`Milestone ${id}: date must be an ISO date`)
  const out: GanttMilestone = { id, date: raw.date }
  if (optStr(raw.label) !== undefined) out.label = optStr(raw.label)
  if (tone(raw.tone)) out.tone = tone(raw.tone)
  if (optStr(raw.ariaLabel) !== undefined) out.ariaLabel = optStr(raw.ariaLabel)
  if (raw.locked === true) out.locked = true
  return out
}

/**
 * A model from JSON: keeps known fields only, checks dates and ids (unique
 * among rows, and among bars and milestones together), and drops links whose
 * ends are not bars of the model. Throws `GanttError` on the rest.
 */
export function parseModel(raw: unknown): GanttModel {
  if (!isObject(raw) || !Array.isArray(raw.rows)) throw new GanttError('A model needs a rows array')
  const rowIds = new Set<string>()
  const itemIds = new Set<string>()
  const rows: GanttRow[] = raw.rows.map((r) => {
    if (!isObject(r)) throw new GanttError('A row must be an object')
    const id = str(r.id, 'row.id')
    if (rowIds.has(id)) throw new GanttError(`Duplicate row id: ${id}`)
    rowIds.add(id)
    const row: GanttRow = { id, label: typeof r.label === 'string' ? r.label : '' }
    if (r.kind === 'group') row.kind = 'group'
    if (isObject(r.cells)) {
      const cells: Record<string, string | number | null> = {}
      for (const [k, v] of Object.entries(r.cells)) {
        if (typeof v === 'string' || typeof v === 'number' || v === null) cells[k] = v
      }
      row.cells = cells
    }
    for (const key of ['bars', 'milestones'] as const) {
      if (r[key] === undefined) continue
      if (!Array.isArray(r[key])) throw new GanttError(`row.${key} must be an array`)
    }
    if (Array.isArray(r.bars)) row.bars = r.bars.map(bar)
    if (Array.isArray(r.milestones)) row.milestones = r.milestones.map(milestone)
    for (const item of [...(row.bars ?? []), ...(row.milestones ?? [])]) {
      if (itemIds.has(item.id)) throw new GanttError(`Duplicate bar or milestone id: ${item.id}`)
      itemIds.add(item.id)
    }
    return row
  })
  const barIds = new Set(rows.flatMap((r) => (r.bars ?? []).map((b) => b.id)))
  const links: GanttLink[] = []
  if (Array.isArray(raw.links)) {
    for (const l of raw.links) {
      if (!isObject(l) || typeof l.id !== 'string' || typeof l.from !== 'string' || typeof l.to !== 'string') continue
      if (!barIds.has(l.from) || !barIds.has(l.to) || l.from === l.to) continue
      links.push(l.locked === true ? { id: l.id, from: l.from, to: l.to, locked: true } : { id: l.id, from: l.from, to: l.to })
    }
  }
  return { rows, links }
}

/** The bar with this id and its row. */
export function findBar(model: GanttModel, id: string): Located<GanttBar> | null {
  for (let i = 0; i < model.rows.length; i++) {
    const row = model.rows[i]!
    const item = row.bars?.find((b) => b.id === id)
    if (item) return { item, row, rowIndex: i }
  }
  return null
}

/** The milestone with this id and its row. */
export function findMilestone(model: GanttModel, id: string): Located<GanttMilestone> | null {
  for (let i = 0; i < model.rows.length; i++) {
    const row = model.rows[i]!
    const item = row.milestones?.find((m) => m.id === id)
    if (item) return { item, row, rowIndex: i }
  }
  return null
}

/** The first and last day over every bar and milestone, or null for an empty model. */
export function extentOf(model: GanttModel): { from: number; to: number } | null {
  let from = Infinity
  let to = -Infinity
  for (const row of model.rows) {
    for (const b of row.bars ?? []) {
      from = Math.min(from, toDay(b.start))
      to = Math.max(to, toDay(b.end))
    }
    for (const m of row.milestones ?? []) {
      from = Math.min(from, toDay(m.date))
      to = Math.max(to, toDay(m.date))
    }
  }
  return Number.isFinite(from) ? { from, to } : null
}

/** Whether a bar ends before `today` (its last day has passed). */
export function isOverdue(bar: Pick<GanttBar, 'end'>, today: string): boolean {
  return toDay(bar.end) < toDay(today)
}

/** Days a bar covers, its first and last day included. */
export function durationOf(bar: Pick<GanttBar, 'start' | 'end'>): number {
  return toDay(bar.end) - toDay(bar.start) + 1
}
