# Vue components

```ts
import { GanttChart, GanttZoom, GanttLegend } from '@dskripchenko/gantt/vue'
import '@dskripchenko/gantt/style.css'
```

## GanttChart

A table of rows on the left and the time scale on the right, in one scroll
area: the table and the header stay in place while the timeline scrolls. The
chart fills its parent's height; give the parent (or the chart) a height.

### Props

| Prop | Type | Default | |
|---|---|---|---|
| `rows` | `GanttRow[]` | — | Rows and group rows |
| `links` | `GanttLink[]` | `[]` | Arrows from a bar's end to another bar's start |
| `columns` | `GanttColumn[]` | the label | Table columns: `{ key, label, width?, main?, align? }`; `width` is a grid track (`84px`, `minmax(0, 1fr)`); the `main` column shows `row.label` and starts group labels |
| `zoom` | `'day' \| 'week' \| 'month' \| 'quarter'` | `'month'` | The unit of a column |
| `from`, `to` | `ISODate` | around today and the data | The range shown; snapped to whole columns |
| `today` | `ISODate` | the viewer's today | Where the today line is |
| `showToday` | `boolean` | `true` | |
| `editable` | `boolean` | `false` | Drag bars, their edges and milestones; arrow keys |
| `linkable` | `boolean` | `false` | Draw links from a bar's end handle; Delete removes one |
| `persist` | `(change) => unknown` | — | Saves a change; a rejected promise takes it back |
| `rowHeight`, `barHeight`, `headerHeight` | `number` | `40`, `20`, `48` | Pixels |
| `tableWidth` | `number` | `360` | Pixels |
| `compactBelow`, `compactTableWidth` | `number` | `640`, `150` | Below this chart width the table keeps its main column only |
| `weekStartsOn` | `number` | `1` | 0 Sunday … 6 Saturday |
| `locale` | `string` | the kit's | `en`, `ru` or a host language |
| `labels` | `Partial<GanttLabels>` | — | Overrides of any string |
| `ariaLabel` | `string` | "Timeline" | |

### Events

- `change(change: GanttChange)` — every change a person makes, including undo
  and redo.
- `error({ change, error })` — `persist` rejected; the change is taken back.
- `open({ kind: 'bar' | 'milestone' | 'row', id, rowId })` — a click without
  a drag, Enter on a bar or milestone, or a click on the main cell.

### Slots

- `cell` `{ row, column, value }` — a table cell (a status pill, a link).
- `group` `{ row }` — a group row's label.
- `header-cell` `{ column }` — a column header.
- `empty` — shown when there are no rows.

### Exposed

`undo()`, `redo()`, `canUndo`, `canRedo`, `scrollToDate(date, 'start' |
'center')`, `scrollToToday()`. The chart scrolls to today when it mounts and
when the zoom changes.

### Mouse, touch and keyboard

- Drag a bar to move it, its edges to move one end, a milestone to move it;
  a tooltip shows the dates. Everything snaps to days.
- Drag from the round handle after a bar onto another bar to link them;
  links to itself, duplicates and loops are refused with a notice.
- Drag the empty background to pan (mouse); scroll as usual otherwise.
- Bars and milestones are buttons in the tab order. ← / → move by a day
  (Shift: a week), Alt+← / → move the end, Alt+Shift+← / → the start, Enter
  opens. A focused link is removed with Delete. Ctrl/⌘+Z undoes,
  Ctrl/⌘+Shift+Z or Ctrl+Y redoes.
- The chart is a `grid`; each bar's name says its row, dates, progress, an
  estimate and its length; changes are announced in a live region.

### Theming

Colours come from the kit's tokens, so `data-theme="dark"` just works. The
`--gt-*` variables on `.gt` override them: `--gt-bg`, `--gt-group-bg`,
`--gt-border`, `--gt-line`, `--gt-text`, `--gt-muted`, `--gt-faint`,
`--gt-today`, `--gt-link`, `--gt-focus`, `--gt-radius`.

## GanttZoom

A radio group of zooms, for `v-model`:

```vue
<GanttZoom v-model="zoom" :zooms="['week', 'month', 'quarter']" />
```

Its names come from `labels.zooms` (Weeks, Months, Quarters by default); a
host that thinks in spans passes its own: `{ week: 'Month', month: 'Quarter',
quarter: 'Year' }`.

## GanttLegend

```vue
<GanttLegend
  :items="[
    { kind: 'bar', label: 'progress' },
    { kind: 'bar', tone: 'danger', label: 'overdue' },
    { kind: 'estimate', label: 'estimated dates' },
    { kind: 'milestone', label: 'release' },
  ]"
  hint="Drag an edge of a bar to change its dates"
/>
```

## Languages

English and Russian ship with the package (`en`, `ru`, `LOCALES`). The
chart follows its `locale` prop, else the kit's locale from a parent
`UidLocaleProvider`. Any string can be replaced with `labels`; dates and
month names are formatted with `Intl` in the chart's language.
