# Модель и ядро

Всё здесь экспортируется из `@dskripchenko/gantt` и работает без DOM.

## Модель

```ts
interface GanttModel {
  rows: GanttRow[]
  links?: GanttLink[]
}

interface GanttRow {
  id: string
  kind?: 'row' | 'group'         // группа — строка-заголовок
  label: string                  // название строки
  cells?: Record<string, string | number | null | undefined> // значения для колонок таблицы
  bars?: GanttBar[]
  milestones?: GanttMilestone[]
}

interface GanttBar {
  id: string
  start: ISODate                 // первый день, 'YYYY-MM-DD'
  end: ISODate                   // последний день, включительно
  progress?: number              // 0–1
  tone?: Tone
  estimate?: boolean             // пунктир, без заливки
  label?: string                 // текст внутри полосы
  ariaLabel?: string
  locked?: boolean               // не перетаскивается
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
  from: string                   // id полосы: та, что идёт первой
  to: string                     // id полосы: та, что идёт следом
  locked?: boolean
}
```

Id полос и вех уникальны в пределах модели. `parseModel(json)` читает
недоверенный JSON: оставляет известные поля, проверяет даты и id, ограничивает
прогресс, отбрасывает связи, концы которых не полосы, и бросает `GanttError`
на всём остальном.

Поиск: `findBar`, `findMilestone`, `extentOf` (первый и последний день всех
элементов), `isOverdue(bar, today)`, `durationOf(bar)`.

## Дни

Даты передаются как ISO-строки и считаются целыми днями от 1970-01-01 по UTC,
поэтому часовые пояса и переход на летнее время их никогда не сдвигают:

```ts
toDay('2026-11-05')          // 20762
fromDay(20762)               // '2026-11-05'
addDays('2026-02-27', 2)     // '2026-03-01'
diffDays(a, b)
todayISO()                   // локальный календарный день зрителя
startOfUnit(day, 'week')     // по умолчанию понедельник; передайте weekStartsOn
shiftUnits(day, 'month', -2)
```

## Шкалы

Масштаб задаёт единицу колонки: `day`, `week`, `month` или `quarter`.
У каждого есть полоса над колонками (месяцы над днями и неделями, кварталы над
месяцами, годы над кварталами), минимальная ширина колонки и диапазон по
умолчанию.

```ts
const scale = createScale({ zoom: 'month', from: '2026-09-15', to: '2027-02-03', width: 900 })
scale.from, scale.to          // выровнены по целым месяцам: 1 сен … 1 мар (не включая)
scale.columns                 // [{ start, end, x, width, bandStart }]
scale.dayWidth                // заполняет `width`, но не меньше минимума масштаба
xOf(scale, '2026-11-05')
dayAt(scale, x)
snapDays(scale, dx)           // расстояние перетаскивания в целых днях
rangeFor('month', today, extentOf(model)) // диапазон по умолчанию вокруг сегодня и данных
```

## Геометрия

```ts
barSpan(scale, bar)           // { x, width } по целым дням
milestoneX(scale, date)       // середина её дня
barBoxes(model, scale, rowHeight, barHeight) // Map прямоугольников полос
linkRoute(fromBox, toBox)     // точки под прямыми углами: из конца, в начало
pathOf(points, radius)        // SVG-путь со скруглёнными углами
```

## Изменения и история

```ts
type GanttChange =
  | { kind: 'bar'; id; rowId; from: { start, end }; to: { start, end } }
  | { kind: 'milestone'; id; rowId; from: ISODate; to: ISODate }
  | { kind: 'link-add'; link: GanttLink }
  | { kind: 'link-remove'; link: GanttLink }
```

- `dragDates(bar, 'move' | 'start' | 'end', days)` — даты после перетаскивания;
  край никогда не заходит за другой, поэтому у полосы остаётся хотя бы один день.
- `applyChange(model, change)` — новая модель с изменением; старая не
  трогается. Бросает `ChangeError`, если изменение не подходит (полоса не там,
  где говорит `from`, связь уже есть, она замкнула бы цикл).
- `invertChange(change)` — его точная противоположность.
- `linkRefusal(model, from, to)` — `'self'`, `'unknown'`, `'duplicate'`,
  `'cycle'` или `null`.
- `History` — `push`, `undo`, `redo`, `peekUndo`, `peekRedo`, `canUndo`,
  `canRedo`, `clear`, с `limit` (по умолчанию 100). Хранит изменения, а не
  модели: источником истины остаются данные хоста.
