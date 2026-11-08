/**
 * Where things are drawn: bars and milestones on a scale, rows stacked
 * down, and the elbow route of a link from one bar's end to another's start.
 */
import { toDay } from './model/dates'
import type { GanttBar, GanttModel } from './model/types'
import { xOf, type Scale } from './scale'

export interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export interface Point {
  x: number
  y: number
}

/** The horizontal span of a bar: from the start of its first day to the end of its last. */
export function barSpan(scale: Scale, bar: Pick<GanttBar, 'start' | 'end'>): { x: number; width: number } {
  const x = xOf(scale, bar.start)
  const width = (toDay(bar.end) - toDay(bar.start) + 1) * scale.dayWidth
  return { x, width }
}

/** The x of a milestone: the middle of its day. */
export function milestoneX(scale: Scale, date: string): number {
  return xOf(scale, date) + scale.dayWidth / 2
}

export interface RowLayout {
  /** Top of each row, by row id. */
  top: Map<string, number>
  rowHeight: number
  height: number
}

export function layoutRows(model: Pick<GanttModel, 'rows'>, rowHeight: number): RowLayout {
  const top = new Map<string, number>()
  model.rows.forEach((row, i) => top.set(row.id, i * rowHeight))
  return { top, rowHeight, height: model.rows.length * rowHeight }
}

export interface BarBox extends Rect {
  id: string
  rowId: string
}

/** Every bar's box, by bar id. Bars sit in the middle of their row, `barHeight` tall. */
export function barBoxes(model: Pick<GanttModel, 'rows'>, scale: Scale, rowHeight: number, barHeight: number): Map<string, BarBox> {
  const boxes = new Map<string, BarBox>()
  model.rows.forEach((row, i) => {
    for (const bar of row.bars ?? []) {
      const { x, width } = barSpan(scale, bar)
      boxes.set(bar.id, { id: bar.id, rowId: row.id, x, width, y: i * rowHeight + (rowHeight - barHeight) / 2, height: barHeight })
    }
  })
  return boxes
}

/** How far a link leaves its bar before it turns. */
export const LINK_STUB = 10

/**
 * The route of a link: out of the right end of `from`, into the left end of
 * `to`, with right angles. When the target starts after the source ends
 * (with room for the stubs) it is one step down; otherwise it goes down to
 * the gap between the rows and back.
 */
export function linkRoute(from: Rect, to: Rect, stub = LINK_STUB): Point[] {
  const sx = from.x + from.width
  const sy = from.y + from.height / 2
  const tx = to.x
  const ty = to.y + to.height / 2
  if (tx - sx >= stub * 2) {
    const mx = sx + stub
    return sy === ty ? [{ x: sx, y: sy }, { x: tx, y: ty }] : [{ x: sx, y: sy }, { x: mx, y: sy }, { x: mx, y: ty }, { x: tx, y: ty }]
  }
  // Back around: down (or up) to between the rows, left past the target's start, then in.
  const down = ty >= sy
  const gapY = down ? Math.max(from.y + from.height, to.y - (to.y - (from.y + from.height)) / 2) : Math.min(from.y, to.y + to.height + (from.y - (to.y + to.height)) / 2)
  const midY = sy === ty ? from.y + from.height + (down ? 1 : -1) * Math.max(4, from.height / 2) : gapY
  return [
    { x: sx, y: sy },
    { x: sx + stub, y: sy },
    { x: sx + stub, y: midY },
    { x: tx - stub, y: midY },
    { x: tx - stub, y: ty },
    { x: tx, y: ty },
  ]
}

/** An SVG path through the points, with the corners rounded by up to `radius`. */
export function pathOf(points: Point[], radius = 4): string {
  if (points.length === 0) return ''
  const first = points[0]!
  let d = `M${round(first.x)},${round(first.y)}`
  for (let i = 1; i < points.length; i++) {
    const p = points[i]!
    const next = points[i + 1]
    if (!next || radius <= 0) {
      d += ` L${round(p.x)},${round(p.y)}`
      continue
    }
    const prev = points[i - 1]!
    const r = Math.min(radius, dist(prev, p) / 2, dist(p, next) / 2)
    const a = toward(p, prev, r)
    const b = toward(p, next, r)
    d += ` L${round(a.x)},${round(a.y)} Q${round(p.x)},${round(p.y)} ${round(b.x)},${round(b.y)}`
  }
  return d
}

const round = (n: number) => Math.round(n * 10) / 10
const dist = (a: Point, b: Point) => Math.hypot(a.x - b.x, a.y - b.y)
function toward(from: Point, to: Point, by: number): Point {
  const d = dist(from, to)
  if (d === 0) return from
  return { x: from.x + ((to.x - from.x) / d) * by, y: from.y + ((to.y - from.y) / d) * by }
}
