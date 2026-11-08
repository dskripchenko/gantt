// @vitest-environment jsdom
import { afterEach, describe, expect, it } from 'vitest'
import { nextTick } from 'vue'
import { flushPromises, mount } from '@vue/test-utils'
import { GanttChart, GanttLegend, GanttZoom } from '../../src/vue'
import { findBar, type GanttChange, type GanttModel, type Zoom } from '../../src/index'
import { TODAY, plan } from '../fixtures/plan'

const wrappers: { unmount(): void }[] = []
afterEach(() => {
  wrappers.splice(0).forEach((w) => w.unmount())
  document.body.innerHTML = ''
})

const columns = [
  { key: 'key', label: 'Key', width: '72px' },
  { key: 'label', label: 'Work', width: 'minmax(0, 1fr)', main: true },
  { key: 'status', label: 'Status', width: '96px' },
]

function chart(props: Record<string, unknown> = {}, model: GanttModel = plan) {
  const w = mount(GanttChart, { props: { rows: model.rows, links: model.links, columns, today: TODAY, from: '2026-09-01', to: '2027-02-28', ...props }, attachTo: document.body })
  wrappers.push(w)
  return w
}

/** A pointer event: jsdom has no PointerEvent, so a mouse event with a pointer id. */
async function pointer(target: { element: Element }, type: string, init: { clientX: number; pointerId: number }) {
  const event = new MouseEvent(type, { bubbles: true, cancelable: true, clientX: init.clientX, button: 0 })
  Object.defineProperty(event, 'pointerId', { value: init.pointerId })
  Object.defineProperty(event, 'pointerType', { value: 'mouse' })
  target.element.dispatchEvent(event)
  await nextTick()
}

const changes = (w: ReturnType<typeof chart>) => (w.emitted('change') ?? []).map((e) => e[0] as GanttChange)

describe('GanttChart', () => {
  it('renders rows, groups, bars, milestones, links and today with names', () => {
    const w = chart()
    expect(w.findAll('.gt-row[data-row-id]')).toHaveLength(plan.rows.length)
    expect(w.findAll('.gt-row--group')).toHaveLength(3)
    expect(w.find('.gt-row--group .gt-group').text()).toBe('Release 1.4')
    expect(w.findAll('[data-bar-id]')).toHaveLength(7)
    expect(w.findAll('[data-milestone-id]')).toHaveLength(3)
    expect(w.findAll('.gt-link')).toHaveLength(2)
    expect(w.find('.gt-today').exists()).toBe(true)
    expect(w.find('.gt-today__badge').text()).toBe('today')
    expect(w.find('.gt').attributes('role')).toBe('grid')
    const a = w.find('[data-bar-id="A"]')
    expect(a.attributes('role')).toBe('button')
    expect(a.attributes('aria-label')).toBe('Webhooks v2: Sep 15 – Nov 20, 64% done, 67 days')
    expect(w.find('[data-bar-id="F"]').classes()).toContain('is-estimate')
    expect(w.find('[data-bar-id="B"]').classes()).toContain('gt-tone--danger')
    expect(w.find('[data-bar-id="A"] .gt-bar__fill').attributes('style')).toContain('width: 64%')
    expect(w.find('[data-milestone-id="m1"]').attributes('aria-label')).toBe('1.4: Nov 20')
    expect(w.find('.gt-link').attributes('aria-label')).toBe('Merchant reports follows Double charges')
  })

  it('labels the header by zoom: quarters over months, months over weeks', () => {
    const w = chart()
    const heads = (c: ReturnType<typeof chart>) => c.findAll('.gt-colhead').map((h) => [h.find('.gt-colhead__band').text(), h.find('.gt-colhead__label').text()])
    expect(heads(w)).toEqual([['Q3', 'September'], ['Q4', 'October'], ['', 'November'], ['', 'December'], ['Q1', 'January'], ['', 'February']])
    const weeks = chart({ zoom: 'week', from: '2026-11-02', to: '2026-11-22' })
    expect(heads(weeks)).toEqual([['November', '2'], ['', '9'], ['', '16']])
  })

  it('names the band of the first column in view after a scroll', async () => {
    const w = chart()
    const scroller = w.find('.gt-scroll').element as HTMLElement
    const third = w.findAll('.gt-colhead')[2]!
    expect(third.find('.gt-colhead__band').text()).toBe('')
    scroller.scrollLeft = parseFloat(third.attributes('style')!.match(/left: ([\d.]+)px/)![1]!) + 2
    scroller.dispatchEvent(new Event('scroll'))
    await nextTick()
    expect(third.find('.gt-colhead__band').text()).toBe('Q4')
  })

  it('speaks Russian when asked', () => {
    const w = chart({ locale: 'ru' })
    expect(w.find('.gt-today__badge').text()).toBe('сегодня')
    expect(w.findAll('.gt-colhead')[0]!.find('.gt-colhead__label').text()).toBe('Сентябрь')
    expect(w.find('[data-bar-id="C"]').attributes('aria-label')).toContain('готово 75%')
  })

  it('reads cells from the row and the main column from the label', () => {
    const w = chart()
    const row = w.find('[data-row-id="a"]')
    expect(row.findAll('.gt-td').map((c) => c.text())).toEqual(['WEB-12', 'Webhooks v2', 'In progress'])
  })

  it('does not change anything unless editable; Enter and click open', async () => {
    const w = chart()
    await w.find('[data-bar-id="C"]').trigger('keydown', { key: 'ArrowRight' })
    expect(w.emitted('change')).toBeUndefined()
    await w.find('[data-bar-id="C"]').trigger('keydown', { key: 'Enter' })
    await w.find('[data-milestone-id="m2"]').trigger('click')
    await w.find('[data-row-id="d"] .gt-td--main').trigger('click')
    expect(w.emitted('open')).toEqual([[{ kind: 'bar', id: 'C', rowId: 'c' }], [{ kind: 'milestone', id: 'm2', rowId: 'r2' }], [{ kind: 'row', id: 'd', rowId: 'd' }]])
  })

  it('moves and resizes bars from the keyboard', async () => {
    const w = chart({ editable: true })
    const c = w.find('[data-bar-id="C"]')
    await c.trigger('keydown', { key: 'ArrowRight' })
    await c.trigger('keydown', { key: 'ArrowLeft', shiftKey: true })
    await c.trigger('keydown', { key: 'ArrowRight', altKey: true })
    await c.trigger('keydown', { key: 'ArrowLeft', altKey: true, shiftKey: true })
    expect(changes(w).map((ch) => (ch.kind === 'bar' ? ch.to : null))).toEqual([
      { start: '2026-10-11', end: '2026-11-15' },
      { start: '2026-10-03', end: '2026-11-07' },
      { start: '2026-10-10', end: '2026-11-15' },
      { start: '2026-10-09', end: '2026-11-14' },
    ])
    await w.find('[data-milestone-id="m1"]').trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    expect(changes(w).at(-1)).toEqual({ kind: 'milestone', id: 'm1', rowId: 'r1', from: '2026-11-20', to: '2026-11-27' })
  })

  it('drags a bar by whole days and reports one change', async () => {
    const w = chart({ editable: true })
    const day = 104 / 30.44
    const scroller = w.find('.gt-scroll')
    await pointer(w.find('[data-bar-id="D"]'), 'pointerdown', { clientX: 200, pointerId: 1 })
    await pointer(scroller, 'pointermove', { clientX: 200 + day * 2.4, pointerId: 1 })
    await pointer(scroller, 'pointermove', { clientX: 200 + day * 4.6, pointerId: 1 })
    expect(w.find('.gt-tip').text()).toBe('Oct 20 – Dec 23 · 65 days')
    await pointer(scroller, 'pointerup', { clientX: 200 + day * 4.6, pointerId: 1 })
    expect(changes(w)).toEqual([{ kind: 'bar', id: 'D', rowId: 'd', from: { start: '2026-10-15', end: '2026-12-18' }, to: { start: '2026-10-20', end: '2026-12-23' } }])
    // The release ends the click: no open after a drag.
    await w.find('[data-bar-id="D"]').trigger('click')
    expect(w.emitted('open')).toBeUndefined()
  })

  it('drags an edge and keeps at least a day', async () => {
    const w = chart({ editable: true })
    const scroller = w.find('.gt-scroll')
    await pointer(w.find('[data-bar-id="E"] .gt-bar__edge--end'), 'pointerdown', { clientX: 300, pointerId: 2 })
    await pointer(scroller, 'pointermove', { clientX: 0, pointerId: 2 })
    await pointer(scroller, 'pointerup', { clientX: 0, pointerId: 2 })
    expect(changes(w)).toEqual([{ kind: 'bar', id: 'E', rowId: 'e', from: { start: '2026-11-03', end: '2026-12-10' }, to: { start: '2026-11-03', end: '2026-11-03' } }])
  })

  it('a locked bar stays put', async () => {
    const locked: GanttModel = { rows: [{ id: 'x', label: 'X', bars: [{ id: 'X', start: '2026-11-01', end: '2026-11-10', locked: true }] }] }
    const w = chart({ editable: true }, locked)
    await w.find('[data-bar-id="X"]').trigger('keydown', { key: 'ArrowRight' })
    await pointer(w.find('[data-bar-id="X"]'), 'pointerdown', { clientX: 10, pointerId: 3 })
    await pointer(w.find('.gt-scroll'), 'pointermove', { clientX: 100, pointerId: 3 })
    await pointer(w.find('.gt-scroll'), 'pointerup', { clientX: 100, pointerId: 3 })
    expect(w.emitted('change')).toBeUndefined()
    expect(w.find('[data-bar-id="X"] .gt-bar__edge').exists()).toBe(false)
  })

  it('shows a persisted change at once and takes it back on failure', async () => {
    let reject: (e: Error) => void = () => undefined
    const w = chart({ editable: true, persist: () => new Promise((_, r) => (reject = r)) })
    const before = w.find('[data-bar-id="C"]').attributes('style')
    await w.find('[data-bar-id="C"]').trigger('keydown', { key: 'ArrowRight', shiftKey: true })
    expect(w.find('[data-bar-id="C"]').attributes('style')).not.toBe(before)
    reject(new Error('nope'))
    await flushPromises()
    expect(w.find('[data-bar-id="C"]').attributes('style')).toBe(before)
    expect((w.emitted('error')![0]![0] as { error: Error }).error.message).toBe('nope')
  })

  it('keeps a saved change until the host passes the new data', async () => {
    const w = chart({ editable: true, persist: () => Promise.resolve() })
    await w.find('[data-bar-id="C"]').trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    const moved = w.find('[data-bar-id="C"]').attributes('style')
    expect(moved).not.toContain('left: 0px')
    const next = { ...plan, rows: plan.rows.map((r) => (r.id === 'c' ? { ...r, bars: [{ ...r.bars![0]!, start: '2026-10-11', end: '2026-11-15' }] } : r)) }
    await w.setProps({ rows: next.rows })
    expect(w.find('[data-bar-id="C"]').attributes('style')).toBe(moved)
    expect(findBar(next, 'C')!.item.start).toBe('2026-10-11')
  })

  it('undoes and redoes with the keyboard', async () => {
    const w = chart({ editable: true, persist: () => Promise.resolve() })
    await w.find('[data-bar-id="C"]').trigger('keydown', { key: 'ArrowRight' })
    await flushPromises()
    await w.find('.gt').trigger('keydown', { key: 'z', ctrlKey: true })
    await flushPromises()
    await w.find('.gt').trigger('keydown', { key: 'z', ctrlKey: true, shiftKey: true })
    await flushPromises()
    expect(changes(w).map((c) => (c.kind === 'bar' ? c.to.start : null))).toEqual(['2026-10-11', '2026-10-10', '2026-10-11'])
    expect((w.vm as unknown as { canRedo: boolean }).canRedo).toBe(false)
  })

  it('removes a link with Delete when links are editable', async () => {
    const w = chart({ linkable: true })
    const link = w.find('.gt-link[data-link-id="l1"]')
    expect(link.attributes('tabindex')).toBe('0')
    await link.trigger('keydown', { key: 'Delete' })
    expect(changes(w)).toEqual([{ kind: 'link-remove', link: { id: 'l1', from: 'C', to: 'E' } }])
    expect(chart().find('.gt-link').attributes('tabindex')).toBeUndefined()
  })

  it('shows the empty state', () => {
    const w = chart({}, { rows: [] })
    expect(w.find('.gt-empty').text()).toBe('Nothing to show')
  })

  it('passes classes to the chart even with its own locale', () => {
    const w = mount(GanttChart, { props: { rows: [], locale: 'ru' }, attrs: { class: 'mine' } })
    wrappers.push(w)
    expect(w.find('.gt').classes()).toContain('mine')
  })
})

describe('GanttZoom', () => {
  it('switches with clicks and arrows', async () => {
    const w = mount(GanttZoom, { props: { modelValue: 'month' as Zoom, 'onUpdate:modelValue': (v: Zoom) => w.setProps({ modelValue: v }) }, attachTo: document.body })
    wrappers.push(w)
    expect(w.findAll('[role="radio"]').map((b) => b.text())).toEqual(['Weeks', 'Months', 'Quarters'])
    expect(w.find('[aria-checked="true"]').text()).toBe('Months')
    await w.find('[data-zoom="quarter"]').trigger('click')
    expect(w.find('[aria-checked="true"]').text()).toBe('Quarters')
    await w.find('.gt-zoom').trigger('keydown', { key: 'ArrowRight' })
    expect(w.find('[aria-checked="true"]').text()).toBe('Weeks')
  })

  it('takes the host names of the zooms', () => {
    const w = mount(GanttZoom, { props: { modelValue: 'week', locale: 'ru', labels: { zooms: { day: 'Д', week: 'Месяц', month: 'Квартал', quarter: 'Год' } } } })
    wrappers.push(w)
    expect(w.text()).toBe('МесяцКварталГод')
  })
})

describe('GanttLegend', () => {
  it('draws swatches like the chart and the hint', () => {
    const w = mount(GanttLegend, { props: { items: [{ kind: 'bar', label: 'done' }, { kind: 'bar', tone: 'danger', label: 'late' }, { kind: 'estimate', label: 'estimate' }, { kind: 'milestone', label: 'release' }], hint: 'Drag' } })
    wrappers.push(w)
    expect(w.findAll('.gt-legend__item')).toHaveLength(4)
    expect(w.findAll('.gt-legend__item')[1]!.classes()).toContain('gt-tone--danger')
    expect(w.find('.is-estimate').exists()).toBe(true)
    expect(w.find('.gt-legend__diamond').exists()).toBe(true)
    expect(w.find('.gt-legend__hint').text()).toBe('Drag')
  })
})
