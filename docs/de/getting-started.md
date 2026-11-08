# Erste Schritte

## Installation

```bash
npm install @dskripchenko/gantt
```

Das Paket hat zwei Einstiegspunkte:

- `@dskripchenko/gantt` — der Kern: das Modell, Kalendertage, Zeitskalen,
  Geometrie und rückgängig machbare Änderungen. Reines TypeScript ohne
  Abhängigkeiten und ohne DOM; es läuft im Browser, in Node 20+ und in einem
  Worker.
- `@dskripchenko/gantt/vue` — `GanttChart`, `GanttZoom` und `GanttLegend`.
  Sie benötigen Vue 3.4+ und [`@dskripchenko/ui`](https://github.com/dskripchenko/ui)
  1.35+, die als optionale Peer-Abhängigkeiten deklariert sind.

```bash
npm install vue @dskripchenko/ui            # für die Komponenten
```

## Styles

Importieren Sie die Styles des Kits und die des Pakets einmal im Einstiegspunkt
der App:

```ts
import '@dskripchenko/ui/styles/all.css'
import '@dskripchenko/gantt/style.css'
```

Die Komponenten verwenden die Tokens des Kits (`--uid-*`), daher folgen das
helle und das dunkle Theme dem `data-theme` des Kits auf `<html>`.

## Ein erstes Diagramm

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

Ein Balken umfasst seine Tage `start` und `end`, beide eingeschlossen.
`progress` (0–1) wird als Füllung gezeichnet; `estimate` zeichnet den Balken
gestrichelt; `tone` wählt seine Farbe (`accent`, `success`, `warning`,
`danger`, `info`, `neutral`, `muted`). Eine Zeile mit `kind: 'group'` ist eine
Kopfzeile; auch sie kann Meilensteine enthalten.

## Bearbeiten

Das Diagramm ändert Ihre Daten nie. Mit `editable` zieht eine Person Balken
(die Mitte verschiebt den Balken, eine Kante das jeweilige Ende) und
Meilensteine, eingerastet auf Tage; mit `linkable` zieht sie Verknüpfungen vom
runden Griff am Ende eines Balkens und entfernt sie mit Entf. Jede Änderung
kommt als `GanttChange` heraus:

```vue
<GanttChart :rows="rows" :links="links" editable linkable :persist="save" />
```

```ts
import { applyChange, type GanttChange } from '@dskripchenko/gantt'

async function save(change: GanttChange) {
  await api.save(change) // werfen, um abzulehnen: das Diagramm nimmt die Änderung zurück
  model.value = applyChange(model.value, change)
}
```

Mit `persist` zeigt das Diagramm die Änderung sofort, behält sie, solange das
Promise läuft und bis neue Daten kommen, und macht sie rückgängig (mit einem
`error`-Event), wenn das Promise abgelehnt wird. Ohne `persist` hören Sie auf
`change` und aktualisieren die Zeilen selbst.

Ctrl+Z / ⌘Z macht eine Änderung rückgängig, Ctrl+Shift+Z / ⌘⇧Z (oder Ctrl+Y)
stellt sie wieder her — beides läuft wie jede andere Änderung über `persist`.

## Wie es weitergeht

- [Modell und Kern](model.md) — die Daten, Skalen, Geometrie und Änderungen.
- [Vue-Komponenten](vue.md) — Props, Events, Slots, Tastatur, Themes, Sprachen.
