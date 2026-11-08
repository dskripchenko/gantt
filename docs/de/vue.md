# Vue-Komponenten

```ts
import { GanttChart, GanttZoom, GanttLegend } from '@dskripchenko/gantt/vue'
import '@dskripchenko/gantt/style.css'
```

## GanttChart

Eine Tabelle mit Zeilen links und die Zeitskala rechts, in einem
Scrollbereich: Tabelle und Kopfzeile bleiben stehen, während die Zeitleiste
scrollt. Das Diagramm füllt die Höhe seines Elternelements; geben Sie dem
Elternelement (oder dem Diagramm) eine Höhe.

### Props

| Prop | Typ | Standard | |
|---|---|---|---|
| `rows` | `GanttRow[]` | — | Zeilen und Gruppenzeilen |
| `links` | `GanttLink[]` | `[]` | Pfeile vom Ende eines Balkens zum Anfang eines anderen |
| `columns` | `GanttColumn[]` | der Name | Tabellenspalten: `{ key, label, width?, main?, align? }`; `width` ist eine Grid-Spur (`84px`, `minmax(0, 1fr)`); die `main`-Spalte zeigt `row.label` und beginnt Gruppennamen |
| `zoom` | `'day' \| 'week' \| 'month' \| 'quarter'` | `'month'` | Die Einheit einer Spalte |
| `from`, `to` | `ISODate` | um heute und die Daten | Der angezeigte Bereich; auf ganze Spalten gerundet |
| `today` | `ISODate` | das Heute des Betrachters | Wo die Heute-Linie liegt |
| `showToday` | `boolean` | `true` | |
| `editable` | `boolean` | `false` | Balken, ihre Kanten und Meilensteine ziehen; Pfeiltasten |
| `linkable` | `boolean` | `false` | Verknüpfungen vom Endgriff eines Balkens ziehen; Entf entfernt eine |
| `persist` | `(change) => unknown` | — | Speichert eine Änderung; ein abgelehntes Promise nimmt sie zurück |
| `rowHeight`, `barHeight`, `headerHeight` | `number` | `40`, `20`, `48` | Pixel |
| `tableWidth` | `number` | `360` | Pixel |
| `compactBelow`, `compactTableWidth` | `number` | `640`, `150` | Unterhalb dieser Diagrammbreite behält die Tabelle nur ihre Hauptspalte |
| `weekStartsOn` | `number` | `1` | 0 Sonntag … 6 Samstag |
| `locale` | `string` | die des Kits | `en`, `ru` oder eine Sprache des Hosts |
| `labels` | `Partial<GanttLabels>` | — | Überschreibt beliebige Texte |
| `ariaLabel` | `string` | "Timeline" | |

### Events

- `change(change: GanttChange)` — jede Änderung, die eine Person vornimmt,
  einschließlich Rückgängig und Wiederherstellen.
- `error({ change, error })` — `persist` hat abgelehnt; die Änderung wird
  zurückgenommen.
- `open({ kind: 'bar' | 'milestone' | 'row', id, rowId })` — ein Klick ohne
  Ziehen, Enter auf einem Balken oder Meilenstein oder ein Klick auf die
  Hauptzelle.

### Slots

- `cell` `{ row, column, value }` — eine Tabellenzelle (ein Status-Badge, ein Link).
- `group` `{ row }` — der Name einer Gruppenzeile.
- `header-cell` `{ column }` — ein Spaltenkopf.
- `empty` — wird angezeigt, wenn es keine Zeilen gibt.

### Exponiert

`undo()`, `redo()`, `canUndo`, `canRedo`, `scrollToDate(date, 'start' |
'center')`, `scrollToToday()`. Das Diagramm scrollt beim Einhängen und beim
Wechsel des Zooms zu heute.

### Maus, Touch und Tastatur

- Ziehen Sie einen Balken, um ihn zu verschieben, seine Kanten, um ein Ende zu
  verschieben, einen Meilenstein, um ihn zu verschieben; ein Tooltip zeigt die
  Daten. Alles rastet auf Tage ein.
- Ziehen Sie vom runden Griff hinter einem Balken auf einen anderen Balken, um
  sie zu verknüpfen; Verknüpfungen mit sich selbst, Duplikate und Zyklen werden
  mit einem Hinweis abgelehnt.
- Ziehen Sie den leeren Hintergrund, um die Ansicht zu verschieben (Maus);
  ansonsten scrollen Sie wie gewohnt.
- Balken und Meilensteine sind Buttons in der Tab-Reihenfolge. ← / → verschieben
  um einen Tag (Shift: eine Woche), Alt+← / → verschieben das Ende,
  Alt+Shift+← / → den Anfang, Enter öffnet. Eine fokussierte Verknüpfung wird
  mit Entf entfernt. Ctrl/⌘+Z macht rückgängig, Ctrl/⌘+Shift+Z oder Ctrl+Y
  stellt wieder her.
- Das Diagramm ist ein `grid`; der Name jedes Balkens nennt seine Zeile, Daten,
  Fortschritt, eine Schätzung und seine Dauer; Änderungen werden in einer
  Live-Region angesagt.

### Theming

Farben kommen aus den Tokens des Kits, daher funktioniert `data-theme="dark"`
einfach. Die `--gt-*`-Variablen auf `.gt` überschreiben sie: `--gt-bg`,
`--gt-group-bg`, `--gt-border`, `--gt-line`, `--gt-text`, `--gt-muted`,
`--gt-faint`, `--gt-today`, `--gt-link`, `--gt-focus`, `--gt-radius`.

## GanttZoom

Eine Radiogruppe von Zooms, für `v-model`:

```vue
<GanttZoom v-model="zoom" :zooms="['week', 'month', 'quarter']" />
```

Die Namen kommen aus `labels.zooms` (standardmäßig Weeks, Months, Quarters);
ein Host, der in Spannen denkt, übergibt eigene: `{ week: 'Month', month: 'Quarter',
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

## Sprachen

Englisch und Russisch sind im Paket enthalten (`en`, `ru`, `LOCALES`). Das
Diagramm folgt seiner `locale`-Prop, sonst der Kit-Locale eines übergeordneten
`UidLocaleProvider`. Jeder Text lässt sich mit `labels` ersetzen; Daten und
Monatsnamen werden mit `Intl` in der Sprache des Diagramms formatiert.
