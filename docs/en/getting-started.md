# Getting started

## Install

```bash
npm install @dskripchenko/gantt
```

The package has two entry points:

- `@dskripchenko/gantt` — the core: the model, calendar days, time scales,
  geometry and undoable changes. Plain TypeScript with no dependencies and no
  DOM; it runs in a browser, in Node 20+ and in a worker.
- `@dskripchenko/gantt/vue` — `GanttChart`, `GanttZoom` and `GanttLegend`.
  They need Vue 3.4+ and [`@dskripchenko/ui`](https://github.com/dskripchenko/ui)
  1.35+, declared as optional peer dependencies.

```bash
npm install vue @dskripchenko/ui            # for the components
```

## Styles

Import the kit's styles and the package's once, in the app entry:

```ts
import '@dskripchenko/ui/styles/all.css'
import '@dskripchenko/gantt/style.css'
```

The components use the kit's tokens (`--uid-*`), so the light and dark themes
follow the kit's `data-theme` on `<html>`.

## A first chart

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart, GanttZoom } from '@dskripchenko/gantt/vue'
import type { GanttRow, Zoom } from '@dskripchenko/gantt'

const zoom = ref<Zoom>('month')
const rows = ref<GanttRow[]>([
  { id: 'g1', kind: 'group', label: 'Release 1.4', milestones: [{ id: 'm1', date: '2026-11-20', label: '1.4', tone: 'warning' }] },
  { id: 'a', label: 'Webhooks v2', bars: [{ id: 'A', start: '2026-09-15', end: '2026-11-20', progress: 0.64 }] },
  { id: 'b', label: 'Failover', bars: [{ id: 'B', start: '2026-09-01', end: '2026-10-31', progress: 0.4, tone: 'danger' }] },
  { id: 'c', label: 'QR payments', bars: [{ id: 'C', start: '2026-12-21', end: '2027-01-29', estimate: true }] },
])
</script>

<template>
  <GanttZoom v-model="zoom" />
  <GanttChart :rows="rows" :zoom="zoom" style="height: 480px" />
</template>
```

A bar covers its `start` and `end` days, both included. `progress` (0–1) is
drawn as a fill; `estimate` draws the bar dashed; `tone` picks its colour
(`accent`, `success`, `warning`, `danger`, `info`, `neutral`, `muted`). A row
with `kind: 'group'` is a header row; it may hold milestones too.

## Editing

The chart never changes your data. With `editable` a person drags bars (the
middle moves the bar, an edge moves that end) and milestones, snapping to
days; with `linkable` they draw links from the round handle at a bar's end
and remove them with Delete. Each change comes out as a `GanttChange`:

```vue
<GanttChart :rows="rows" :links="links" editable linkable :persist="save" />
```

```ts
import { applyChange, type GanttChange } from '@dskripchenko/gantt'

async function save(change: GanttChange) {
  await api.save(change) // throw to refuse: the chart takes the change back
  model.value = applyChange(model.value, change)
}
```

With `persist`, the chart shows the change at once, keeps it while the
promise runs and until new data comes in, and rolls it back (with an `error`
event) when the promise rejects. Without `persist`, listen to `change` and
update the rows yourself.

Ctrl+Z / ⌘Z undoes a change and Ctrl+Shift+Z / ⌘⇧Z (or Ctrl+Y) redoes it —
both go through `persist` like any other change.

## Next

- [Model and core](model.md) — the data, scales, geometry and changes.
- [Vue components](vue.md) — props, events, slots, keyboard, themes, languages.
