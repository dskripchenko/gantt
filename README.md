# @dskripchenko/gantt

[![CI](https://github.com/dskripchenko/gantt/actions/workflows/ci.yml/badge.svg)](https://github.com/dskripchenko/gantt/actions/workflows/ci.yml)
[![npm](https://img.shields.io/npm/v/@dskripchenko/gantt.svg)](https://www.npmjs.com/package/@dskripchenko/gantt)
[![license](https://img.shields.io/npm/l/@dskripchenko/gantt.svg)](LICENSE)

Timelines and Gantt charts: rows and groups, bars with progress, milestones,
links, a today line, zoom from days to quarters — and editing by dragging,
with the host deciding what is saved. The core has **no runtime
dependencies**; the Vue components are built on
[`@dskripchenko/ui`](https://github.com/dskripchenko/ui).

```vue
<script setup lang="ts">
import { ref } from 'vue'
import { GanttChart, GanttZoom } from '@dskripchenko/gantt/vue'
import { applyChange, type GanttChange, type GanttModel, type Zoom } from '@dskripchenko/gantt'
import '@dskripchenko/ui/styles/all.css'
import '@dskripchenko/gantt/style.css'

const zoom = ref<Zoom>('month')
const plan = ref<GanttModel>({ rows: [] })
fetch('/api/plan').then((r) => r.json()).then((m: GanttModel) => (plan.value = m))

async function save(change: GanttChange) {
  const r = await fetch('/api/plan/changes', { method: 'POST', body: JSON.stringify(change) })
  if (!r.ok) throw new Error(await r.text()) // the chart takes the change back
  plan.value = applyChange(plan.value, change)
}
</script>

<template>
  <GanttZoom v-model="zoom" />
  <GanttChart :rows="plan.rows" :links="plan.links" :zoom="zoom" editable linkable :persist="save" style="height: 600px" />
</template>
```

## What is inside

**Core** (`@dskripchenko/gantt`, plain TypeScript, no DOM)

- A JSON model: rows and group rows, bars (first and last day, progress,
  tone, estimate, locked), milestones and links; strict parsing.
- Calendar days as whole numbers in UTC — no time-zone or daylight-saving
  drift — with week, month, quarter and year arithmetic.
- Time scales: day, week, month and quarter columns with bands above
  (months, quarters, years), stretched to the width and never narrower than
  readable; a default range around today and the data.
- Geometry: bars over whole days, milestones, right-angled link routes.
- Changes with exact inverses — move, resize, move a milestone, add and
  remove a link (no loops) — applied without mutating, and an undo history.

**Vue** (`@dskripchenko/gantt/vue`)

- `GanttChart` — a sticky table with your columns and slots, a two-level
  header, group rows, bars with progress, dashed estimates, tones,
  milestones with labels, links, the today line; drag to move and resize
  with snapping and a tooltip, draw links from a handle, pan, scroll to
  today; optimistic saving with rollback; undo and redo; keyboard editing,
  ARIA names and live announcements; a compact table on phones; light and
  dark from the kit's tokens; English and Russian.
- `GanttZoom` — the scale switch. `GanttLegend` — swatches drawn like the
  chart.

## Documentation

| | English | Русский | Deutsch | 中文 |
|---|---|---|---|---|
| Getting started | [en](docs/en/getting-started.md) | [ru](docs/ru/getting-started.md) | [de](docs/de/getting-started.md) | [zh](docs/zh/getting-started.md) |
| Model and core | [en](docs/en/model.md) | [ru](docs/ru/model.md) | [de](docs/de/model.md) | [zh](docs/zh/model.md) |
| Vue components | [en](docs/en/vue.md) | [ru](docs/ru/vue.md) | [de](docs/de/vue.md) | [zh](docs/zh/vue.md) |

## Development

```bash
pnpm install
pnpm dev              # playground: ?view=readonly | empty, &theme=dark, &locale=ru, &zoom=week
pnpm test             # unit and component tests
pnpm check:browser    # Playwright: rendering, geometry, dragging, links, undo, screenshots
pnpm lint && pnpm typecheck && pnpm build
```

## License

[MIT](LICENSE)
