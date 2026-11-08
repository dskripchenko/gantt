# Model and core

Everything here comes from `@dskripchenko/gantt` and works without a DOM.

## The model

```ts
interface GanttModel {
  rows: GanttRow[]
  links?: GanttLink[]
}

interface GanttRow {
  id: string
  kind?: 'row' | 'group'         // a group is a header row
  label: string                  // the row's name
  cells?: Record<string, string | number | null | undefined> // values for table columns
  bars?: GanttBar[]
  milestones?: GanttMilestone[]
}

interface GanttBar {
  id: string
  start: ISODate                 // first day, 'YYYY-MM-DD'
  end: ISODate                   // last day, included
  progress?: number              // 0–1
  tone?: Tone
  estimate?: boolean             // dashed, no fill
  label?: string                 // text inside the bar
  ariaLabel?: string
  locked?: boolean               // never dragged
}

interface GanttMilestone {
  id: string
  date: ISODate
  label?: string
  tone?: Tone
  ariaLabel?: string
  locked?: boolean
}

interface GanttLink {
  id: string
  from: string                   // bar id: the one that comes first
  to: string                     // bar id: the one that follows
  locked?: boolean
}
```

Bar and milestone ids are unique across the model. `parseModel(json)` reads
untrusted JSON: it keeps known fields, checks dates and ids, clamps progress,
drops links whose ends are not bars, and throws `GanttError` on the rest.

Lookups: `findBar`, `findMilestone`, `extentOf` (the first and last day of
all items), `isOverdue(bar, today)`, `durationOf(bar)`.

## Days

Dates travel as ISO strings and are counted as whole days since 1970-01-01
in UTC, so time zones and daylight saving never shift them:

```ts
toDay('2026-11-05')          // 20762
fromDay(20762)               // '2026-11-05'
addDays('2026-02-27', 2)     // '2026-03-01'
diffDays(a, b)
todayISO()                   // the viewer's local calendar day
startOfUnit(day, 'week')     // Monday by default; pass weekStartsOn
shiftUnits(day, 'month', -2)
```

## Scales

A zoom names the unit of a column: `day`, `week`, `month` or `quarter`.
Each has a band above the columns (months over days and weeks, quarters over
months, years over quarters), a minimum column width and a default span.

```ts
const scale = createScale({ zoom: 'month', from: '2026-09-15', to: '2027-02-03', width: 900 })
scale.from, scale.to          // snapped to whole months: Sep 1 … Mar 1 (exclusive)
scale.columns                 // [{ start, end, x, width, bandStart }]
scale.dayWidth                // fills `width`, never below the zoom's minimum
xOf(scale, '2026-11-05')
dayAt(scale, x)
snapDays(scale, dx)           // a drag distance in whole days
rangeFor('month', today, extentOf(model)) // a default range around today and the data
```

## Geometry

```ts
barSpan(scale, bar)           // { x, width } over whole days
milestoneX(scale, date)       // the middle of its day
barBoxes(model, scale, rowHeight, barHeight) // Map of bar boxes
linkRoute(fromBox, toBox)     // right-angled points: out of the end, into the start
pathOf(points, radius)        // an SVG path with rounded corners
```

## Changes and history

```ts
type GanttChange =
  | { kind: 'bar'; id; rowId; from: { start, end }; to: { start, end } }
  | { kind: 'milestone'; id; rowId; from: ISODate; to: ISODate }
  | { kind: 'link-add'; link: GanttLink }
  | { kind: 'link-remove'; link: GanttLink }
```

- `dragDates(bar, 'move' | 'start' | 'end', days)` — the dates after a drag;
  an edge never passes the other, so a bar keeps at least one day.
- `applyChange(model, change)` — a new model with the change; the old one is
  untouched. Throws `ChangeError` if the change does not fit (the bar is not
  where `from` says, the link exists already, it would close a loop).
- `invertChange(change)` — its exact inverse.
- `linkRefusal(model, from, to)` — `'self'`, `'unknown'`, `'duplicate'`,
  `'cycle'` or `null`.
- `History` — `push`, `undo`, `redo`, `peekUndo`, `peekRedo`, `canUndo`,
  `canRedo`, `clear`, with a `limit` (100 by default). It keeps changes, not
  models: the host's data stays the source of truth.
