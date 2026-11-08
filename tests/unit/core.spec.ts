import { describe, expect, it } from 'vitest'
import {
  ChangeError,
  GanttError,
  History,
  addDays,
  applyChange,
  barBoxes,
  barSpan,
  createScale,
  dayAt,
  diffDays,
  dragDates,
  durationOf,
  extentOf,
  findBar,
  fromDay,
  invertChange,
  isISODate,
  isOverdue,
  linkRefusal,
  linkRoute,
  milestoneX,
  parseModel,
  pathOf,
  rangeFor,
  shiftUnits,
  snapDays,
  startOfUnit,
  toDay,
  todayISO,
  xOf,
  type GanttChange,
} from '../../src/index'
import { TODAY, plan } from '../fixtures/plan'

describe('dates', () => {
  it('counts days in UTC and back', () => {
    expect(toDay('1970-01-01')).toBe(0)
    expect(fromDay(toDay('2026-11-05'))).toBe('2026-11-05')
    expect(addDays('2026-02-27', 2)).toBe('2026-03-01')
    expect(addDays('2024-02-28', 1)).toBe('2024-02-29')
    expect(diffDays('2026-10-25', '2026-10-26')).toBe(1) // across a daylight-saving change
    expect(addDays('2026-01-01', -1)).toBe('2025-12-31')
  })

  it('accepts only real ISO dates', () => {
    expect(isISODate('2026-02-29')).toBe(false)
    expect(isISODate('2026-2-01')).toBe(false)
    expect(isISODate('2028-02-29')).toBe(true)
    expect(isISODate(20261105)).toBe(false)
    expect(() => toDay('tomorrow')).toThrow(RangeError)
  })

  it('reads today in local time', () => {
    expect(todayISO(new Date(2026, 10, 5, 23, 59))).toBe('2026-11-05')
  })

  it('finds unit starts', () => {
    const thu = toDay('2026-11-05')
    expect(fromDay(startOfUnit(thu, 'week'))).toBe('2026-11-02')
    expect(fromDay(startOfUnit(thu, 'week', 0))).toBe('2026-11-01')
    expect(fromDay(startOfUnit(thu, 'month'))).toBe('2026-11-01')
    expect(fromDay(startOfUnit(thu, 'quarter'))).toBe('2026-10-01')
    expect(fromDay(startOfUnit(thu, 'year'))).toBe('2026-01-01')
    expect(fromDay(shiftUnits(thu, 'month', -2))).toBe('2026-09-01')
    expect(fromDay(shiftUnits(thu, 'month', 3))).toBe('2027-02-01')
    expect(fromDay(shiftUnits(thu, 'quarter', -1))).toBe('2026-07-01')
  })
})

describe('model', () => {
  it('parses strictly and drops dangling links', () => {
    const model = parseModel({ ...plan, links: [...plan.links!, { id: 'x', from: 'A', to: 'nope' }, { id: 'y', from: 'A', to: 'A' }], extra: 1 })
    expect(model.rows).toHaveLength(plan.rows.length)
    expect(model.links!.map((l) => l.id)).toEqual(['l1', 'l2'])
    expect(() => parseModel({ rows: [{ id: 'a', label: '', bars: [{ id: 'x', start: '2026-02-30', end: '2026-03-01' }] }] })).toThrow(GanttError)
    expect(() => parseModel({ rows: [{ id: 'a', label: '', bars: [{ id: 'x', start: '2026-03-02', end: '2026-03-01' }] }] })).toThrow(/before start/)
    expect(() => parseModel({ rows: [{ id: 'a', label: '' }, { id: 'a', label: '' }] })).toThrow(/Duplicate row/)
    expect(() => parseModel({ rows: [{ id: 'a', label: '', bars: [{ id: 'x', start: '2026-03-01', end: '2026-03-01' }], milestones: [{ id: 'x', date: '2026-03-01' }] }] })).toThrow(/Duplicate bar/)
  })

  it('clamps progress and keeps known tones only', () => {
    const model = parseModel({ rows: [{ id: 'a', label: 'A', bars: [{ id: 'x', start: '2026-03-01', end: '2026-03-02', progress: 3, tone: 'purple' }] }] })
    expect(model.rows[0]!.bars![0]).toEqual({ id: 'x', start: '2026-03-01', end: '2026-03-02', progress: 1 })
  })

  it('finds items, the extent, overdue and duration', () => {
    expect(findBar(plan, 'C')?.row.id).toBe('c')
    const extent = extentOf(plan)!
    expect(fromDay(extent.from)).toBe('2026-09-01')
    expect(fromDay(extent.to)).toBe('2027-02-26')
    expect(extentOf({ rows: [] })).toBeNull()
    expect(isOverdue({ end: '2026-10-31' }, TODAY)).toBe(true)
    expect(isOverdue({ end: TODAY }, TODAY)).toBe(false)
    expect(durationOf({ start: TODAY, end: TODAY })).toBe(1)
  })
})

describe('scale', () => {
  it('snaps a month scale to whole months and fills the width', () => {
    const scale = createScale({ zoom: 'month', from: '2026-09-15', to: '2027-02-03', width: 1200 })
    expect(fromDay(scale.from)).toBe('2026-09-01')
    expect(fromDay(scale.to)).toBe('2027-03-01')
    expect(scale.columns).toHaveLength(6)
    expect(scale.width).toBeCloseTo(1200)
    expect(scale.columns.map((c) => c.bandStart)).toEqual([true, true, false, false, true, false])
    expect(scale.columns[1]!.x).toBeCloseTo(30 * scale.dayWidth)
  })

  it('keeps the minimum column width when the range is long', () => {
    const scale = createScale({ zoom: 'month', from: '2026-01-01', to: '2027-12-31', width: 600 })
    expect(scale.columns).toHaveLength(24)
    expect(scale.columns[1]!.width).toBeGreaterThanOrEqual(104 * (28 / 30.44) - 0.01)
    expect(scale.width).toBeGreaterThan(600)
  })

  it('builds week and quarter columns', () => {
    const weeks = createScale({ zoom: 'week', from: '2026-11-05', to: '2026-11-30' })
    expect(fromDay(weeks.from)).toBe('2026-11-02')
    expect(weeks.columns).toHaveLength(5)
    expect(weeks.columns[0]!.width).toBe(72)
    const quarters = createScale({ zoom: 'quarter', from: '2026-05-01', to: '2027-02-01' })
    expect(quarters.columns.map((c) => fromDay(c.start))).toEqual(['2026-04-01', '2026-07-01', '2026-10-01', '2027-01-01'])
    expect(quarters.columns.map((c) => c.bandStart)).toEqual([true, false, false, true])
  })

  it('maps days and pixels both ways and snaps drags to days', () => {
    const scale = createScale({ zoom: 'week', from: '2026-11-02', to: '2026-11-29' })
    expect(xOf(scale, '2026-11-02')).toBe(0)
    expect(xOf(scale, '2026-11-03')).toBeCloseTo(scale.dayWidth)
    expect(fromDay(dayAt(scale, scale.dayWidth * 2.5))).toBe('2026-11-04')
    expect(snapDays(scale, scale.dayWidth * 0.4)).toBe(0)
    expect(snapDays(scale, -scale.dayWidth * 0.4)).toBe(0)
    expect(Object.is(snapDays(scale, -scale.dayWidth * 0.4), -0)).toBe(false)
    expect(snapDays(scale, scale.dayWidth * 2.6)).toBe(3)
  })

  it('picks a range around today and around the data', () => {
    expect(rangeFor('month', TODAY)).toEqual({ from: '2026-09-01', to: '2027-02-28' })
    const wide = rangeFor('month', TODAY, extentOf(plan))
    expect(wide.from).toBe('2026-08-01')
    expect(wide.to).toBe('2027-03-31')
  })
})

describe('geometry', () => {
  const scale = createScale({ zoom: 'week', from: '2026-11-02', to: '2026-11-29' })

  it('places bars over whole days and milestones in the middle of theirs', () => {
    expect(barSpan(scale, { start: '2026-11-03', end: '2026-11-03' })).toEqual({ x: scale.dayWidth, width: scale.dayWidth })
    expect(milestoneX(scale, '2026-11-02')).toBeCloseTo(scale.dayWidth / 2)
    const boxes = barBoxes(plan, scale, 40, 20)
    expect(boxes.get('C')).toMatchObject({ rowId: 'c', y: 3 * 40 + 10, height: 20 })
  })

  it('routes a link one step down when there is room', () => {
    const route = linkRoute({ x: 0, y: 10, width: 50, height: 20 }, { x: 100, y: 50, width: 40, height: 20 })
    expect(route).toEqual([
      { x: 50, y: 20 },
      { x: 60, y: 20 },
      { x: 60, y: 60 },
      { x: 100, y: 60 },
    ])
  })

  it('routes a link around when the target starts before the source ends', () => {
    const route = linkRoute({ x: 0, y: 10, width: 100, height: 20 }, { x: 40, y: 50, width: 40, height: 20 })
    expect(route[0]).toEqual({ x: 100, y: 20 })
    expect(route.at(-1)).toEqual({ x: 40, y: 60 })
    expect(route[2]!.y).toBe(40) // between the rows
    expect(route[3]!.x).toBe(30)
    expect(pathOf(route)).toMatch(/^M100,20 L.* L40,60$/)
  })
})

describe('changes', () => {
  it('moves and resizes by days, keeping at least one day', () => {
    const bar = { start: '2026-11-02', end: '2026-11-06' }
    expect(dragDates(bar, 'move', 3)).toEqual({ start: '2026-11-05', end: '2026-11-09' })
    expect(dragDates(bar, 'end', -2)).toEqual({ start: '2026-11-02', end: '2026-11-04' })
    expect(dragDates(bar, 'end', -10)).toEqual({ start: '2026-11-02', end: '2026-11-02' })
    expect(dragDates(bar, 'start', 10)).toEqual({ start: '2026-11-06', end: '2026-11-06' })
    expect(dragDates(bar, 'start', -1)).toEqual({ start: '2026-11-01', end: '2026-11-06' })
  })

  it('applies a change without touching the model, and its inverse brings it back', () => {
    const change: GanttChange = { kind: 'bar', id: 'C', rowId: 'c', from: { start: '2026-10-10', end: '2026-11-14' }, to: { start: '2026-10-12', end: '2026-11-16' } }
    const next = applyChange(plan, change)
    expect(findBar(next, 'C')!.item.end).toBe('2026-11-16')
    expect(findBar(plan, 'C')!.item.end).toBe('2026-11-14')
    expect(applyChange(next, invertChange(change))).toEqual(plan)
    expect(() => applyChange(plan, invertChange(change))).toThrow(ChangeError)
  })

  it('moves milestones and adds and removes links', () => {
    const moved = applyChange(plan, { kind: 'milestone', id: 'm2', rowId: 'r2', from: '2026-12-18', to: '2026-12-22' })
    expect(moved.rows[4]!.milestones![0]!.date).toBe('2026-12-22')
    const link = { id: 'l3', from: 'B', to: 'D' }
    const linked = applyChange(plan, { kind: 'link-add', link })
    expect(linked.links).toHaveLength(3)
    expect(applyChange(linked, { kind: 'link-remove', link }).links).toEqual(plan.links)
    expect(() => applyChange(plan, { kind: 'link-remove', link })).toThrow(ChangeError)
  })

  it('refuses links to itself, twice, to unknown bars and in loops', () => {
    expect(linkRefusal(plan, 'A', 'A')).toBe('self')
    expect(linkRefusal(plan, 'C', 'E')).toBe('duplicate')
    expect(linkRefusal(plan, 'A', 'Z')).toBe('unknown')
    expect(linkRefusal(plan, 'E', 'C')).toBe('cycle')
    expect(linkRefusal(plan, 'F', 'A')).toBe('cycle')
    expect(linkRefusal(plan, 'B', 'D')).toBeNull()
    expect(() => applyChange(plan, { kind: 'link-add', link: { id: 'x', from: 'E', to: 'C' } })).toThrow(/cycle/)
  })

  it('undoes and redoes, and a new change clears the redo', () => {
    const history = new History({ limit: 2 })
    const a: GanttChange = { kind: 'milestone', id: 'm1', rowId: 'r1', from: '2026-11-20', to: '2026-11-21' }
    const b: GanttChange = { kind: 'milestone', id: 'm1', rowId: 'r1', from: '2026-11-21', to: '2026-11-22' }
    const c: GanttChange = { kind: 'milestone', id: 'm1', rowId: 'r1', from: '2026-11-22', to: '2026-11-23' }
    history.push(a)
    history.push(b)
    history.push(c)
    expect(history.peekUndo()).toEqual(invertChange(c))
    expect(history.undo()).toEqual(invertChange(c))
    expect(history.undo()).toEqual(invertChange(b))
    expect(history.undo()).toBeNull() // the limit dropped a
    expect(history.canRedo).toBe(true)
    expect(history.redo()).toEqual(b)
    history.push(a)
    expect(history.canRedo).toBe(false)
    history.clear()
    expect(history.canUndo).toBe(false)
  })
})
