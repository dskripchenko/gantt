/**
 * What a person changes on a chart, as plain data: a bar's dates, a
 * milestone's date, a link added or removed. Each change has an exact
 * inverse, applies to a model without touching it (a new model comes back),
 * and goes into an undo history.
 */
import { addDays, toDay } from './model/dates'
import { findBar, findMilestone } from './model/parse'
import type { GanttBar, GanttLink, GanttModel } from './model/types'

export type BarDates = Pick<GanttBar, 'start' | 'end'>

export type GanttChange =
  | { kind: 'bar'; id: string; rowId: string; from: BarDates; to: BarDates }
  | { kind: 'milestone'; id: string; rowId: string; from: string; to: string }
  | { kind: 'link-add'; link: GanttLink }
  | { kind: 'link-remove'; link: GanttLink }

/** Which part of a bar a drag holds. */
export type DragMode = 'move' | 'start' | 'end'

/**
 * The bar's dates after a drag of `days`: moved whole, or one edge moved.
 * An edge never passes the other one: a bar keeps at least one day.
 */
export function dragDates(bar: BarDates, mode: DragMode, days: number): BarDates {
  if (days === 0) return { start: bar.start, end: bar.end }
  if (mode === 'move') return { start: addDays(bar.start, days), end: addDays(bar.end, days) }
  if (mode === 'start') {
    const start = Math.min(toDay(bar.start) + days, toDay(bar.end))
    return { start: addDays(bar.start, start - toDay(bar.start)), end: bar.end }
  }
  const end = Math.max(toDay(bar.end) + days, toDay(bar.start))
  return { start: bar.start, end: addDays(bar.end, end - toDay(bar.end)) }
}

export function sameDates(a: BarDates, b: BarDates): boolean {
  return a.start === b.start && a.end === b.end
}

/** The change that undoes this one. */
export function invertChange(change: GanttChange): GanttChange {
  switch (change.kind) {
    case 'bar':
      return { ...change, from: change.to, to: change.from }
    case 'milestone':
      return { ...change, from: change.to, to: change.from }
    case 'link-add':
      return { kind: 'link-remove', link: change.link }
    case 'link-remove':
      return { kind: 'link-add', link: change.link }
  }
}

export class ChangeError extends Error {
  override name = 'ChangeError'
}

/**
 * A new model with the change made. Throws `ChangeError` when the change
 * does not fit the model: an unknown bar or milestone, dates that are not
 * where the change expects them, a link that exists already or is missing.
 */
export function applyChange(model: GanttModel, change: GanttChange): GanttModel {
  switch (change.kind) {
    case 'bar': {
      const found = findBar(model, change.id)
      if (!found) throw new ChangeError(`No bar ${change.id}`)
      if (!sameDates(found.item, change.from)) throw new ChangeError(`Bar ${change.id} is not at ${change.from.start}…${change.from.end}`)
      if (toDay(change.to.end) < toDay(change.to.start)) throw new ChangeError(`Bar ${change.id}: end before start`)
      return {
        ...model,
        rows: model.rows.map((row) => (row !== found.row ? row : { ...row, bars: row.bars!.map((b) => (b.id === change.id ? { ...b, start: change.to.start, end: change.to.end } : b)) })),
      }
    }
    case 'milestone': {
      const found = findMilestone(model, change.id)
      if (!found) throw new ChangeError(`No milestone ${change.id}`)
      if (found.item.date !== change.from) throw new ChangeError(`Milestone ${change.id} is not at ${change.from}`)
      return {
        ...model,
        rows: model.rows.map((row) => (row !== found.row ? row : { ...row, milestones: row.milestones!.map((m) => (m.id === change.id ? { ...m, date: change.to } : m)) })),
      }
    }
    case 'link-add': {
      const reason = linkRefusal(model, change.link.from, change.link.to)
      if (reason) throw new ChangeError(`Link ${change.link.from} → ${change.link.to}: ${reason}`)
      return { ...model, links: [...(model.links ?? []), change.link] }
    }
    case 'link-remove': {
      const links = model.links ?? []
      if (!links.some((l) => l.id === change.link.id)) throw new ChangeError(`No link ${change.link.id}`)
      return { ...model, links: links.filter((l) => l.id !== change.link.id) }
    }
  }
}

export type LinkRefusal = 'self' | 'unknown' | 'duplicate' | 'cycle'

/** Why a link from `from` to `to` cannot be drawn, or null when it can. */
export function linkRefusal(model: GanttModel, from: string, to: string): LinkRefusal | null {
  if (from === to) return 'self'
  if (!findBar(model, from) || !findBar(model, to)) return 'unknown'
  const links = model.links ?? []
  if (links.some((l) => l.from === from && l.to === to)) return 'duplicate'
  // `to` already leads to `from`: the new link would close a loop.
  const next = new Map<string, string[]>()
  for (const l of links) next.set(l.from, [...(next.get(l.from) ?? []), l.to])
  const seen = new Set<string>()
  const stack = [to]
  while (stack.length > 0) {
    const at = stack.pop()!
    if (at === from) return 'cycle'
    if (seen.has(at)) continue
    seen.add(at)
    stack.push(...(next.get(at) ?? []))
  }
  return null
}

export interface HistoryOptions {
  /** How many steps are kept; the oldest go first. */
  limit?: number
}

/** Undo and redo over changes. It keeps changes, not models: the host's data stays the truth. */
export class History {
  private done: GanttChange[] = []
  private undone: GanttChange[] = []
  private readonly limit: number

  constructor(options: HistoryOptions = {}) {
    this.limit = Math.max(1, options.limit ?? 100)
  }

  /** A change that was made: clears what could be redone. */
  push(change: GanttChange): void {
    this.done.push(change)
    if (this.done.length > this.limit) this.done.shift()
    this.undone = []
  }

  get canUndo(): boolean {
    return this.done.length > 0
  }

  get canRedo(): boolean {
    return this.undone.length > 0
  }

  /** The change that undoes the last one, without taking it yet. */
  peekUndo(): GanttChange | null {
    const last = this.done[this.done.length - 1]
    return last ? invertChange(last) : null
  }

  peekRedo(): GanttChange | null {
    return this.undone[this.undone.length - 1] ?? null
  }

  /** Takes the last change back: returns what to apply to undo it. */
  undo(): GanttChange | null {
    const last = this.done.pop()
    if (!last) return null
    this.undone.push(last)
    return invertChange(last)
  }

  redo(): GanttChange | null {
    const next = this.undone.pop()
    if (!next) return null
    this.done.push(next)
    return next
  }

  clear(): void {
    this.done = []
    this.undone = []
  }
}
