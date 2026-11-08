<script setup lang="ts">
/**
 * A timeline: a table of rows on the left, the time scale on the right,
 * bars with progress, milestones, links and a today line. In an editable
 * chart a person drags bars (whole, or by an edge) and milestones, snapping
 * to days, and draws links from a bar's end handle to another bar. The
 * chart never edits the host's data: it reports each change (`change`), and
 * with `persist` it shows the change at once and takes it back if the
 * promise fails.
 */
import { computed, nextTick, onBeforeUnmount, onMounted, ref, shallowRef, watch } from 'vue'
import {
  History,
  applyChange,
  barSpan,
  barBoxes,
  createScale,
  dragDates,
  durationOf,
  extentOf,
  findBar,
  linkRefusal,
  linkRoute,
  milestoneX,
  pathOf,
  rangeFor,
  sameDates,
  shiftUnits,
  snapDays,
  toDay,
  todayISO,
  xOf,
  ZOOMS,
  addDays,
  type DragMode,
  type GanttBar,
  type GanttChange,
  type GanttLink,
  type GanttMilestone,
  type GanttModel,
  type GanttRow,
  type ISODate,
  type Zoom,
} from '../index'
import { resolveLabels, type GanttLabels } from './labels'
import { useLocaleScope } from './localeScope'
import { formatDate, headerCell } from './format'

export interface GanttColumn {
  key: string
  label: string
  /** A CSS grid track: `84px`, `minmax(0, 1fr)`. */
  width?: string
  /** The column of the row's name: group rows start there, a narrow chart keeps only it. */
  main?: boolean
  align?: 'start' | 'end' | 'center'
}

export interface OpenTarget {
  kind: 'bar' | 'milestone' | 'row'
  id: string
  rowId: string
}

export interface ChangeFailure {
  change: GanttChange
  error: unknown
}

/** What `persist` is given; a rejected promise takes the change back. */
export type PersistChange = (change: GanttChange) => unknown

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    rows: GanttRow[]
    links?: GanttLink[]
    columns?: GanttColumn[]
    zoom?: Zoom
    /** First day shown; by default a range around today that takes in every bar. */
    from?: ISODate
    to?: ISODate
    today?: ISODate
    showToday?: boolean
    /** Bars and milestones can be dragged and moved with the keyboard. */
    editable?: boolean
    /** Links can be drawn from a bar's end handle and removed with Delete. */
    linkable?: boolean
    persist?: PersistChange
    rowHeight?: number
    barHeight?: number
    headerHeight?: number
    /** The table's width in pixels. */
    tableWidth?: number
    /** Below this width of the chart the table keeps its main column only. */
    compactBelow?: number
    compactTableWidth?: number
    weekStartsOn?: number
    locale?: string
    labels?: Partial<GanttLabels>
    ariaLabel?: string
  }>(),
  {
    links: () => [],
    columns: () => [{ key: 'label', label: '', width: 'minmax(0, 1fr)', main: true }],
    zoom: 'month',
    showToday: true,
    editable: false,
    linkable: false,
    rowHeight: 40,
    barHeight: 20,
    headerHeight: 48,
    tableWidth: 360,
    compactBelow: 640,
    compactTableWidth: 150,
    weekStartsOn: 1,
  },
)

const emit = defineEmits<{
  change: [change: GanttChange]
  error: [failure: ChangeFailure]
  open: [target: OpenTarget]
}>()

defineSlots<{
  cell?: (props: { row: GanttRow; column: GanttColumn; value: string | number | null | undefined }) => unknown
  group?: (props: { row: GanttRow }) => unknown
  'header-cell'?: (props: { column: GanttColumn }) => unknown
  empty?: () => unknown
}>()

const { lang, wrapper, wrapperProps } = useLocaleScope(() => props.locale)
const t = computed<GanttLabels>(() => resolveLabels(lang.value, props.labels))
const today = computed(() => props.today ?? todayISO())

// ------------------------------------------------------------------ model

/** Changes shown before the host's data has them: in flight, or saved and not yet passed back. */
const local = shallowRef<{ change: GanttChange; settled: boolean }[]>([])
const hostModel = computed<GanttModel>(() => ({ rows: props.rows, links: props.links }))
watch(hostModel, () => {
  local.value = local.value.filter((entry) => !entry.settled)
})
const model = computed<GanttModel>(() => {
  let m = hostModel.value
  for (const { change } of local.value) {
    try {
      m = applyChange(m, change)
    } catch {
      // The host's data has it already, or moved on: the host wins.
    }
  }
  return m
})

// ------------------------------------------------------------------ size and scale

const root = ref<HTMLElement | null>(null)
const scroller = ref<HTMLElement | null>(null)
const body = ref<HTMLElement | null>(null)
const viewWidth = ref(0)
let observer: ResizeObserver | null = null
onMounted(() => {
  const el = scroller.value
  if (!el) return
  viewWidth.value = el.clientWidth
  if (typeof ResizeObserver !== 'undefined') {
    observer = new ResizeObserver(() => {
      viewWidth.value = el.clientWidth
    })
    observer.observe(el)
  }
  void nextTick(() => scrollToToday())
})
onBeforeUnmount(() => observer?.disconnect())

const compact = computed(() => viewWidth.value > 0 && viewWidth.value < props.compactBelow)
const shownColumns = computed(() => {
  if (!compact.value) return props.columns
  const main = props.columns.find((c) => c.main) ?? props.columns[0]
  return main ? [{ ...main, width: 'minmax(0, 1fr)' }] : []
})
const mainIndex = computed(() => Math.max(0, shownColumns.value.findIndex((c) => c.main)))
const tableW = computed(() => (compact.value ? props.compactTableWidth : props.tableWidth))
const gridColumns = computed(() => shownColumns.value.map((c) => c.width ?? 'minmax(0, 1fr)').join(' '))

const range = computed(() => {
  if (props.from && props.to) return { from: props.from, to: props.to }
  const auto = rangeFor(props.zoom, today.value, extentOf(hostModel.value), props.weekStartsOn)
  return { from: props.from ?? auto.from, to: props.to ?? auto.to }
})
const scale = computed(() =>
  createScale({ zoom: props.zoom, from: range.value.from, to: range.value.to, width: Math.max(0, viewWidth.value - tableW.value - 1), weekStartsOn: props.weekStartsOn }),
)
const header = computed(() => scale.value.columns.map((column) => ({ column, ...headerCell(column, props.zoom, lang.value, t.value) })))
const todayX = computed(() => {
  const d = toDay(today.value)
  if (d < scale.value.from || d >= scale.value.to) return null
  return xOf(scale.value, d) + scale.value.dayWidth / 2
})

function scrollToDate(date: ISODate, align: 'start' | 'center' = 'start') {
  const el = scroller.value
  if (!el) return
  const visible = el.clientWidth - tableW.value
  if (align === 'center') {
    el.scrollLeft = Math.max(0, xOf(scale.value, date) - visible / 2)
    return
  }
  // A few columns before the date stay in view, as many as fit a third of the view.
  const unit = ZOOMS[props.zoom].unit
  const column = scale.value.width / Math.max(1, scale.value.columns.length)
  const lead = Math.min(ZOOMS[props.zoom].lead, Math.floor(visible / column / 3))
  el.scrollLeft = Math.max(0, xOf(scale.value, shiftUnits(toDay(date), unit, -lead, props.weekStartsOn)))
}
function scrollToToday() {
  if (todayX.value !== null) scrollToDate(today.value)
}
watch(() => props.zoom, () => void nextTick(scrollToToday))

// ------------------------------------------------------------------ geometry of what is drawn

const boxes = computed(() => barBoxes(model.value, scale.value, props.rowHeight, props.barHeight))

interface Drag {
  kind: 'bar' | 'milestone'
  id: string
  rowId: string
  mode: DragMode
  startX: number
  days: number
  moved: boolean
  pointerId: number
}
const drag = ref<Drag | null>(null)

/** A bar's dates with the drag in progress. */
function datesOf(bar: GanttBar, rowId: string): { start: string; end: string } {
  const d = drag.value
  if (d && d.kind === 'bar' && d.id === bar.id && d.rowId === rowId) return dragDates(bar, d.mode, d.days)
  return { start: bar.start, end: bar.end }
}
function milestoneDate(m: GanttMilestone): string {
  const d = drag.value
  return d && d.kind === 'milestone' && d.id === m.id ? addDays(m.date, d.days) : m.date
}

interface DrawnBar {
  bar: GanttBar
  x: number
  width: number
  start: string
  end: string
  progress: number
}
const drawn = computed(() =>
  model.value.rows.map((row) => ({
    row,
    bars: (row.bars ?? []).map<DrawnBar>((bar) => {
      const dates = datesOf(bar, row.id)
      const { x, width } = barSpan(scale.value, dates)
      return { bar, x, width, ...dates, progress: Math.round((bar.progress ?? 0) * 100) }
    }),
    milestones: (row.milestones ?? []).map((m) => ({ m, x: milestoneX(scale.value, milestoneDate(m)), date: milestoneDate(m) })),
  })),
)

const linkPaths = computed(() => {
  const d = drag.value
  const shown = new Map(boxes.value)
  // A bar in a drag pulls its links along.
  if (d && d.kind === 'bar') {
    const found = findBar(model.value, d.id)
    const box = shown.get(d.id)
    if (found && box) {
      const { x, width } = barSpan(scale.value, dragDates(found.item, d.mode, d.days))
      shown.set(d.id, { ...box, x, width })
    }
  }
  return (model.value.links ?? []).flatMap((link) => {
    const a = shown.get(link.from)
    const b = shown.get(link.to)
    if (!a || !b) return []
    return [{ link, d: pathOf(linkRoute(a, b)), fromName: nameOfBar(link.from), toName: nameOfBar(link.to) }]
  })
})

function nameOfBar(id: string): string {
  const found = findBar(model.value, id)
  return found ? found.item.label || found.row.label : id
}

// ------------------------------------------------------------------ texts

const fmt = (date: string) => formatDate(lang.value, date, today.value)
function barAria(row: GanttRow, b: DrawnBar): string {
  if (b.bar.ariaLabel) return b.bar.ariaLabel
  const extra = [b.bar.progress !== undefined ? t.value.progress(b.progress) : '', b.bar.estimate ? t.value.estimate : '', t.value.days(durationOf(b))].filter(Boolean).join(', ')
  return t.value.barAria(b.bar.label || row.label, fmt(b.start), fmt(b.end), extra)
}
const tooltip = computed(() => {
  const d = drag.value
  if (!d || !d.moved) return null
  if (d.kind === 'bar') {
    const row = drawn.value.find((r) => r.row.id === d.rowId)
    const b = row?.bars.find((x) => x.bar.id === d.id)
    if (!row || !b) return null
    return { rowIndex: model.value.rows.indexOf(row.row), x: b.x + b.width / 2, text: `${fmt(b.start)} – ${fmt(b.end)} · ${t.value.days(durationOf(b))}` }
  }
  const row = drawn.value.find((r) => r.row.id === d.rowId)
  const m = row?.milestones.find((x) => x.m.id === d.id)
  if (!row || !m) return null
  return { rowIndex: model.value.rows.indexOf(row.row), x: m.x, text: fmt(m.date) }
})
const announcement = ref('')

// ------------------------------------------------------------------ committing changes

const history = new History()
const canUndo = ref(false)
const canRedo = ref(false)
const syncHistory = () => {
  canUndo.value = history.canUndo
  canRedo.value = history.canRedo
}

function describe(change: GanttChange): string {
  switch (change.kind) {
    case 'bar':
      return t.value.moved(nameOfBar(change.id), fmt(change.to.start), fmt(change.to.end))
    case 'milestone': {
      const row = model.value.rows.find((r) => r.id === change.rowId)
      const m = row?.milestones?.find((x) => x.id === change.id)
      return t.value.moved(m?.label || row?.label || change.id, fmt(change.to), fmt(change.to))
    }
    case 'link-add':
      return t.value.linked(nameOfBar(change.link.from), nameOfBar(change.link.to))
    case 'link-remove':
      return t.value.unlinked(nameOfBar(change.link.from), nameOfBar(change.link.to))
  }
}

/** Reports a change; with `persist`, shows it until the host has it, or takes it back on failure. */
async function commit(change: GanttChange): Promise<boolean> {
  try {
    applyChange(model.value, change)
  } catch {
    return false
  }
  emit('change', change)
  const text = describe(change)
  if (!props.persist) {
    announcement.value = text
    return true
  }
  const entry = { change, settled: false }
  local.value = [...local.value, entry]
  try {
    await props.persist(change)
    entry.settled = true
    announcement.value = text
    return true
  } catch (error) {
    local.value = local.value.filter((e) => e !== entry)
    announcement.value = t.value.failed
    emit('error', { change, error })
    return false
  }
}

async function edit(change: GanttChange) {
  if (await commit(change)) {
    history.push(change)
    syncHistory()
  }
}

async function undo(): Promise<boolean> {
  const change = history.peekUndo()
  if (!change) return false
  if (!(await commit(change))) {
    // The data moved on under the history: it no longer applies.
    history.clear()
    syncHistory()
    return false
  }
  history.undo()
  syncHistory()
  return true
}

async function redo(): Promise<boolean> {
  const change = history.peekRedo()
  if (!change) return false
  if (!(await commit(change))) {
    history.clear()
    syncHistory()
    return false
  }
  history.redo()
  syncHistory()
  return true
}

defineExpose({ undo, redo, canUndo, canRedo, scrollToDate, scrollToToday })

// ------------------------------------------------------------------ pointer: bars and milestones

let suppressClick = false

function startDrag(e: PointerEvent, kind: 'bar' | 'milestone', id: string, rowId: string, mode: DragMode, locked?: boolean) {
  if (e.button !== 0 || !props.editable || locked) return
  e.stopPropagation()
  const target = e.currentTarget as HTMLElement
  target.setPointerCapture?.(e.pointerId)
  drag.value = { kind, id, rowId, mode, startX: e.clientX, days: 0, moved: false, pointerId: e.pointerId }
}

function onDragMove(e: PointerEvent) {
  const d = drag.value
  if (!d || e.pointerId !== d.pointerId) return
  const dx = e.clientX - d.startX
  if (!d.moved && Math.abs(dx) < 3) return
  d.moved = true
  d.days = snapDays(scale.value, dx)
}

function onDragEnd(e: PointerEvent) {
  const d = drag.value
  if (!d || e.pointerId !== d.pointerId) return
  drag.value = null
  if (!d.moved) return
  suppressClick = true
  setTimeout(() => (suppressClick = false), 0)
  if (d.days === 0) return
  if (d.kind === 'bar') {
    const found = findBar(model.value, d.id)
    if (!found) return
    const to = dragDates(found.item, d.mode, d.days)
    if (!sameDates(to, found.item)) void edit({ kind: 'bar', id: d.id, rowId: d.rowId, from: { start: found.item.start, end: found.item.end }, to })
  } else {
    const row = model.value.rows.find((r) => r.id === d.rowId)
    const m = row?.milestones?.find((x) => x.id === d.id)
    if (m) void edit({ kind: 'milestone', id: d.id, rowId: d.rowId, from: m.date, to: addDays(m.date, d.days) })
  }
}

function onDragCancel() {
  drag.value = null
  linking.value = null
}

function open(target: OpenTarget) {
  if (suppressClick) return
  emit('open', target)
}

// ------------------------------------------------------------------ keyboard

function onBarKey(e: KeyboardEvent, row: GanttRow, bar: GanttBar) {
  if (e.key === 'Enter') {
    emit('open', { kind: 'bar', id: bar.id, rowId: row.id })
    return
  }
  if (!props.editable || bar.locked || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
  e.preventDefault()
  const sign = e.key === 'ArrowLeft' ? -1 : 1
  const mode: DragMode = e.altKey ? (e.shiftKey ? 'start' : 'end') : 'move'
  const days = sign * (mode === 'move' && e.shiftKey ? 7 : 1)
  const to = dragDates(bar, mode, days)
  if (!sameDates(to, bar)) void edit({ kind: 'bar', id: bar.id, rowId: row.id, from: { start: bar.start, end: bar.end }, to })
}

function onMilestoneKey(e: KeyboardEvent, row: GanttRow, m: GanttMilestone) {
  if (e.key === 'Enter') {
    emit('open', { kind: 'milestone', id: m.id, rowId: row.id })
    return
  }
  if (!props.editable || m.locked || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return
  e.preventDefault()
  const days = (e.key === 'ArrowLeft' ? -1 : 1) * (e.shiftKey ? 7 : 1)
  void edit({ kind: 'milestone', id: m.id, rowId: row.id, from: m.date, to: addDays(m.date, days) })
}

function onLinkKey(e: KeyboardEvent, link: GanttLink) {
  if (!props.linkable || link.locked || (e.key !== 'Delete' && e.key !== 'Backspace')) return
  e.preventDefault()
  void edit({ kind: 'link-remove', link })
}

function onRootKey(e: KeyboardEvent) {
  if (!(e.metaKey || e.ctrlKey) || e.altKey) return
  const key = e.key.toLowerCase()
  if (key === 'z' && !e.shiftKey) {
    e.preventDefault()
    void undo()
  } else if ((key === 'z' && e.shiftKey) || key === 'y') {
    e.preventDefault()
    void redo()
  }
}

// ------------------------------------------------------------------ links

const linking = ref<{ from: string; x: number; y: number; pointerId: number; over: string | null } | null>(null)
const linkRefusalText = ref('')

function bodyPoint(e: PointerEvent): { x: number; y: number } {
  const rect = body.value?.getBoundingClientRect()
  return { x: e.clientX - (rect?.left ?? 0) - tableW.value, y: e.clientY - (rect?.top ?? 0) }
}

function startLink(e: PointerEvent, bar: GanttBar) {
  if (e.button !== 0 || !props.linkable) return
  e.stopPropagation()
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  linking.value = { from: bar.id, ...bodyPoint(e), pointerId: e.pointerId, over: null }
}

function barUnder(e: PointerEvent): string | null {
  const el = typeof document !== 'undefined' && document.elementFromPoint ? document.elementFromPoint(e.clientX, e.clientY) : null
  const hit = el?.closest?.('[data-bar-id]') as HTMLElement | null | undefined
  return hit?.dataset.barId ?? null
}

function onLinkMove(e: PointerEvent) {
  const l = linking.value
  if (!l || e.pointerId !== l.pointerId) return
  Object.assign(l, bodyPoint(e), { over: barUnder(e) })
}

function onLinkEnd(e: PointerEvent) {
  const l = linking.value
  if (!l || e.pointerId !== l.pointerId) return
  linking.value = null
  const to = barUnder(e) ?? l.over
  if (!to) return
  const refusal = linkRefusal(model.value, l.from, to)
  if (refusal) {
    linkRefusalText.value = t.value.linkRefused[refusal]
    announcement.value = linkRefusalText.value
    setTimeout(() => (linkRefusalText.value = ''), 2500)
    return
  }
  void edit({ kind: 'link-add', link: { id: `${l.from}->${to}`, from: l.from, to } })
}

const linkLine = computed(() => {
  const l = linking.value
  const box = l ? boxes.value.get(l.from) : undefined
  if (!l || !box) return null
  return { x1: box.x + box.width, y1: box.y + box.height / 2, x2: l.x, y2: l.y }
})

function onPointerMove(e: PointerEvent) {
  onDragMove(e)
  onLinkMove(e)
  onPanMove(e)
}
function onPointerUp(e: PointerEvent) {
  onDragEnd(e)
  onLinkEnd(e)
  onPanEnd(e)
}

// ------------------------------------------------------------------ panning the background

const pan = ref<{ x: number; y: number; left: number; top: number; pointerId: number } | null>(null)
function onPanStart(e: PointerEvent) {
  if (e.button !== 0 || e.pointerType !== 'mouse' || !scroller.value) return
  const target = e.target as HTMLElement
  if (!target.closest('.gt-lane') || target.closest('.gt-bar, .gt-ms, .gt-link')) return
  pan.value = { x: e.clientX, y: e.clientY, left: scroller.value.scrollLeft, top: scroller.value.scrollTop, pointerId: e.pointerId }
  scroller.value.setPointerCapture?.(e.pointerId)
}
function onPanMove(e: PointerEvent) {
  const p = pan.value
  if (!p || e.pointerId !== p.pointerId || !scroller.value) return
  scroller.value.scrollLeft = p.left - (e.clientX - p.x)
  scroller.value.scrollTop = p.top - (e.clientY - p.y)
}
function onPanEnd(e: PointerEvent) {
  if (pan.value && e.pointerId === pan.value.pointerId) pan.value = null
}

// ------------------------------------------------------------------ helpers for the template

const cellValue = (row: GanttRow, column: GanttColumn) => row.cells?.[column.key] ?? (column.main ? row.label : undefined)
const barClasses = (b: DrawnBar) => [
  `gt-tone--${b.bar.tone ?? 'accent'}`,
  { 'is-estimate': b.bar.estimate, 'is-locked': b.bar.locked || !props.editable, 'is-dragging': drag.value?.id === b.bar.id, 'is-target': linking.value?.over === b.bar.id && linking.value.from !== b.bar.id },
]
const rowCount = computed(() => model.value.rows.length + 1)
const descId = `gt-keys-${Math.random().toString(36).slice(2, 8)}`
</script>

<template>
  <component
    :is="wrapper"
    v-bind="wrapperProps"
  >
    <div
      v-bind="$attrs"
      ref="root"
      class="gt"
      :class="{ 'is-compact': compact, 'is-editable': editable, 'is-panning': pan !== null, 'is-linking': linking !== null }"
      :style="{ '--gt-row': `${rowHeight}px`, '--gt-bar': `${barHeight}px`, '--gt-head': `${headerHeight}px`, '--gt-table': `${tableW}px` }"
      role="grid"
      :aria-label="ariaLabel ?? t.chart"
      :aria-rowcount="rowCount"
      :aria-colcount="shownColumns.length + 1"
      @keydown="onRootKey"
    >
      <div
        ref="scroller"
        class="gt-scroll"
        @pointerdown="onPanStart"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onDragCancel"
      >
        <div
          class="gt-inner"
          :style="{ width: `${tableW + scale.width}px` }"
        >
          <div
            class="gt-head"
            role="row"
            aria-rowindex="1"
          >
            <div
              class="gt-table gt-head__table"
              :style="{ gridTemplateColumns: gridColumns }"
            >
              <span
                v-for="column in shownColumns"
                :key="column.key"
                role="columnheader"
                class="gt-th"
                :class="`gt-align--${column.align ?? 'start'}`"
              >
                <slot
                  name="header-cell"
                  :column="column"
                >{{ column.label }}</slot>
              </span>
            </div>
            <div
              class="gt-head__time"
              role="columnheader"
              :style="{ width: `${scale.width}px` }"
            >
              <div
                v-for="h in header"
                :key="h.column.start"
                class="gt-colhead"
                :style="{ left: `${h.column.x}px`, width: `${h.column.width}px` }"
              >
                <div class="gt-colhead__band">
                  {{ h.band }}
                </div>
                <div class="gt-colhead__label">
                  {{ h.label }}
                </div>
              </div>
              <span
                v-if="showToday && todayX !== null"
                class="gt-today__badge"
                :style="{ left: `${todayX}px` }"
              >{{ t.today }}</span>
            </div>
          </div>

          <div
            ref="body"
            class="gt-body"
          >
            <div
              class="gt-grid"
              aria-hidden="true"
              :style="{ left: `${tableW}px`, width: `${scale.width}px` }"
            >
              <span
                v-for="h in header"
                :key="h.column.start"
                class="gt-grid__line"
                :style="{ left: `${h.column.x}px` }"
              />
            </div>

            <div
              v-for="(r, i) in drawn"
              :key="r.row.id"
              class="gt-row"
              :class="{ 'gt-row--group': r.row.kind === 'group' }"
              role="row"
              :aria-rowindex="i + 2"
              :data-row-id="r.row.id"
            >
              <div
                class="gt-table gt-cells"
                :style="{ gridTemplateColumns: gridColumns }"
              >
                <template v-if="r.row.kind === 'group'">
                  <span
                    v-for="n in mainIndex"
                    :key="n"
                    role="gridcell"
                  />
                  <span
                    role="rowheader"
                    class="gt-group"
                    :style="{ gridColumn: `${mainIndex + 1} / -1` }"
                  >
                    <slot
                      name="group"
                      :row="r.row"
                    >{{ r.row.label }}</slot>
                  </span>
                </template>
                <template v-else>
                  <span
                    v-for="column in shownColumns"
                    :key="column.key"
                    :role="column.main ? 'rowheader' : 'gridcell'"
                    class="gt-td"
                    :class="[`gt-align--${column.align ?? 'start'}`, { 'gt-td--main': column.main }]"
                    @click="column.main && open({ kind: 'row', id: r.row.id, rowId: r.row.id })"
                  >
                    <slot
                      name="cell"
                      :row="r.row"
                      :column="column"
                      :value="cellValue(r.row, column)"
                    >{{ cellValue(r.row, column) ?? '' }}</slot>
                  </span>
                </template>
              </div>

              <div
                class="gt-lane"
                role="gridcell"
                :style="{ width: `${scale.width}px` }"
              >
                <div
                  v-for="b in r.bars"
                  :key="b.bar.id"
                  class="gt-bar"
                  :class="barClasses(b)"
                  :style="{ left: `${b.x}px`, width: `${Math.max(b.width, 4)}px` }"
                  role="button"
                  tabindex="0"
                  :data-bar-id="b.bar.id"
                  :aria-label="barAria(r.row, b)"
                  :aria-describedby="editable && !b.bar.locked ? descId : undefined"
                  @pointerdown="startDrag($event, 'bar', b.bar.id, r.row.id, 'move', b.bar.locked)"
                  @click="open({ kind: 'bar', id: b.bar.id, rowId: r.row.id })"
                  @keydown="onBarKey($event, r.row, b.bar)"
                >
                  <span
                    v-if="!b.bar.estimate && b.progress > 0"
                    class="gt-bar__fill"
                    :style="{ width: `${b.progress}%` }"
                  />
                  <span
                    v-if="b.bar.label"
                    class="gt-bar__label"
                  >{{ b.bar.label }}</span>
                  <template v-if="editable && !b.bar.locked">
                    <span
                      class="gt-bar__edge gt-bar__edge--start"
                      aria-hidden="true"
                      @pointerdown="startDrag($event, 'bar', b.bar.id, r.row.id, 'start')"
                    />
                    <span
                      class="gt-bar__edge gt-bar__edge--end"
                      aria-hidden="true"
                      @pointerdown="startDrag($event, 'bar', b.bar.id, r.row.id, 'end')"
                    />
                  </template>
                  <span
                    v-if="linkable"
                    class="gt-bar__handle"
                    :title="t.linkHandle"
                    aria-hidden="true"
                    @pointerdown="startLink($event, b.bar)"
                  />
                </div>
                <div
                  v-for="ms in r.milestones"
                  :key="ms.m.id"
                  class="gt-ms"
                  :class="[`gt-tone--${ms.m.tone ?? 'neutral'}`, { 'is-locked': ms.m.locked || !editable, 'is-dragging': drag?.id === ms.m.id }]"
                  :style="{ left: `${ms.x}px` }"
                  role="button"
                  tabindex="0"
                  :data-milestone-id="ms.m.id"
                  :aria-label="ms.m.ariaLabel ?? t.milestoneAria(ms.m.label ?? r.row.label, fmt(ms.date))"
                  :aria-describedby="editable && !ms.m.locked ? `${descId}-m` : undefined"
                  @pointerdown="startDrag($event, 'milestone', ms.m.id, r.row.id, 'move', ms.m.locked)"
                  @click="open({ kind: 'milestone', id: ms.m.id, rowId: r.row.id })"
                  @keydown="onMilestoneKey($event, r.row, ms.m)"
                >
                  <span class="gt-ms__diamond" />
                  <span
                    v-if="ms.m.label"
                    class="gt-ms__label"
                  >{{ ms.m.label }}</span>
                </div>
              </div>
            </div>

            <div
              v-if="drawn.length === 0"
              class="gt-row gt-row--empty"
            >
              <div class="gt-table gt-cells gt-empty">
                <slot name="empty">
                  {{ t.empty }}
                </slot>
              </div>
            </div>
            <div
              class="gt-row gt-row--filler"
              aria-hidden="true"
            >
              <div class="gt-table gt-cells" />
            </div>

            <svg
              class="gt-links"
              :style="{ left: `${tableW}px`, width: `${scale.width}px` }"
              :width="scale.width"
              :height="drawn.length * rowHeight"
            >
              <defs>
                <marker
                  :id="`${descId}-arrow`"
                  viewBox="0 0 8 8"
                  refX="7"
                  refY="4"
                  markerWidth="7"
                  markerHeight="7"
                  orient="auto-start-reverse"
                >
                  <path
                    d="M0,0 L8,4 L0,8 z"
                    class="gt-link__head"
                  />
                </marker>
              </defs>
              <g
                v-for="p in linkPaths"
                :key="p.link.id"
                class="gt-link"
                :class="{ 'is-editable': linkable && !p.link.locked }"
                :data-link-id="p.link.id"
                :tabindex="linkable && !p.link.locked ? 0 : undefined"
                :role="linkable && !p.link.locked ? 'button' : undefined"
                :aria-label="t.linkAria(p.fromName, p.toName)"
                :aria-describedby="linkable && !p.link.locked ? `${descId}-l` : undefined"
                @keydown="onLinkKey($event, p.link)"
              >
                <path
                  class="gt-link__hit"
                  :d="p.d"
                />
                <path
                  class="gt-link__line"
                  :d="p.d"
                  :marker-end="`url(#${descId}-arrow)`"
                />
              </g>
              <line
                v-if="linkLine"
                class="gt-link__draft"
                :x1="linkLine.x1"
                :y1="linkLine.y1"
                :x2="linkLine.x2"
                :y2="linkLine.y2"
              />
            </svg>

            <div
              v-if="showToday && todayX !== null"
              class="gt-today"
              aria-hidden="true"
              :style="{ left: `${tableW + todayX}px` }"
            />
            <div
              v-if="tooltip"
              class="gt-tip"
              role="status"
              :style="{ left: `${tableW + tooltip.x}px`, top: `${tooltip.rowIndex * rowHeight}px` }"
            >
              {{ tooltip.text }}
            </div>
          </div>
        </div>
      </div>
      <div
        v-if="linkRefusalText"
        class="gt-notice"
        role="alert"
      >
        {{ linkRefusalText }}
      </div>
      <span
        :id="descId"
        class="gt-sr"
      >{{ t.barKeys }}</span>
      <span
        :id="`${descId}-m`"
        class="gt-sr"
      >{{ t.milestoneKeys }}</span>
      <span
        :id="`${descId}-l`"
        class="gt-sr"
      >{{ t.linkKeys }}</span>
      <span
        class="gt-sr"
        aria-live="polite"
      >{{ announcement }}</span>
    </div>
  </component>
</template>
