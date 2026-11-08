# Modell und Kern

Alles hier kommt aus `@dskripchenko/gantt` und funktioniert ohne DOM.

## Das Modell

```ts
interface GanttModel {
  rows: GanttRow[]
  links?: GanttLink[]
}

interface GanttRow {
  id: string
  kind?: 'row' | 'group'         // eine Gruppe ist eine Kopfzeile
  label: string                  // der Name der Zeile
  cells?: Record<string, string | number | null | undefined> // Werte für Tabellenspalten
  bars?: GanttBar[]
  milestones?: GanttMilestone[]
}

interface GanttBar {
  id: string
  start: ISODate                 // erster Tag, 'YYYY-MM-DD'
  end: ISODate                   // letzter Tag, eingeschlossen
  progress?: number              // 0–1
  tone?: Tone
  estimate?: boolean             // gestrichelt, ohne Füllung
  label?: string                 // Text im Balken
  ariaLabel?: string
  locked?: boolean               // nie gezogen
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
  from: string                   // Balken-ID: der, der zuerst kommt
  to: string                     // Balken-ID: der, der folgt
  locked?: boolean
}
```

IDs von Balken und Meilensteinen sind im ganzen Modell eindeutig.
`parseModel(json)` liest nicht vertrauenswürdiges JSON: Es behält bekannte
Felder, prüft Daten und IDs, begrenzt den Fortschritt, verwirft Verknüpfungen,
deren Enden keine Balken sind, und wirft bei allem anderen `GanttError`.

Abfragen: `findBar`, `findMilestone`, `extentOf` (der erste und letzte Tag
aller Elemente), `isOverdue(bar, today)`, `durationOf(bar)`.

## Tage

Daten werden als ISO-Zeichenketten übergeben und als ganze Tage seit
1970-01-01 in UTC gezählt, sodass Zeitzonen und Sommerzeit sie nie verschieben:

```ts
toDay('2026-11-05')          // 20762
fromDay(20762)               // '2026-11-05'
addDays('2026-02-27', 2)     // '2026-03-01'
diffDays(a, b)
todayISO()                   // der lokale Kalendertag des Betrachters
startOfUnit(day, 'week')     // standardmäßig Montag; weekStartsOn übergeben
shiftUnits(day, 'month', -2)
```

## Skalen

Ein Zoom benennt die Einheit einer Spalte: `day`, `week`, `month` oder
`quarter`. Jeder hat ein Band über den Spalten (Monate über Tagen und Wochen,
Quartale über Monaten, Jahre über Quartalen), eine Mindestbreite der Spalte
und eine Standardspanne.

```ts
const scale = createScale({ zoom: 'month', from: '2026-09-15', to: '2027-02-03', width: 900 })
scale.from, scale.to          // auf ganze Monate gerundet: 1. Sep … 1. Mär (exklusiv)
scale.columns                 // [{ start, end, x, width, bandStart }]
scale.dayWidth                // füllt `width`, nie unter dem Minimum des Zooms
xOf(scale, '2026-11-05')
dayAt(scale, x)
snapDays(scale, dx)           // eine Ziehdistanz in ganzen Tagen
rangeFor('month', today, extentOf(model)) // ein Standardbereich um heute und die Daten
```

## Geometrie

```ts
barSpan(scale, bar)           // { x, width } über ganze Tage
milestoneX(scale, date)       // die Mitte seines Tages
barBoxes(model, scale, rowHeight, barHeight) // Map der Balkenrechtecke
linkRoute(fromBox, toBox)     // rechtwinklige Punkte: aus dem Ende, in den Anfang
pathOf(points, radius)        // ein SVG-Pfad mit abgerundeten Ecken
```

## Änderungen und Verlauf

```ts
type GanttChange =
  | { kind: 'bar'; id; rowId; from: { start, end }; to: { start, end } }
  | { kind: 'milestone'; id; rowId; from: ISODate; to: ISODate }
  | { kind: 'link-add'; link: GanttLink }
  | { kind: 'link-remove'; link: GanttLink }
```

- `dragDates(bar, 'move' | 'start' | 'end', days)` — die Daten nach einem
  Ziehen; eine Kante überholt nie die andere, daher behält ein Balken
  mindestens einen Tag.
- `applyChange(model, change)` — ein neues Modell mit der Änderung; das alte
  bleibt unberührt. Wirft `ChangeError`, wenn die Änderung nicht passt (der
  Balken ist nicht dort, wo `from` sagt, die Verknüpfung existiert bereits, sie
  würde einen Zyklus schließen).
- `invertChange(change)` — ihr genaues Gegenteil.
- `linkRefusal(model, from, to)` — `'self'`, `'unknown'`, `'duplicate'`,
  `'cycle'` oder `null`.
- `History` — `push`, `undo`, `redo`, `peekUndo`, `peekRedo`, `canUndo`,
  `canRedo`, `clear`, mit einem `limit` (standardmäßig 100). Sie speichert
  Änderungen, keine Modelle: Die Daten des Hosts bleiben die Quelle der
  Wahrheit.
