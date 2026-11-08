# Начало работы

## Установка

```bash
npm install @dskripchenko/gantt
```

У пакета две точки входа:

- `@dskripchenko/gantt` — ядро: модель, календарные дни, шкалы времени,
  геометрия и отменяемые изменения. Чистый TypeScript без зависимостей и без
  DOM; работает в браузере, в Node 20+ и в воркере.
- `@dskripchenko/gantt/vue` — `GanttChart`, `GanttZoom` и `GanttLegend`.
  Им нужны Vue 3.4+ и [`@dskripchenko/ui`](https://github.com/dskripchenko/ui)
  1.35+, объявленные как необязательные peer-зависимости.

```bash
npm install vue @dskripchenko/ui            # для компонентов
```

## Стили

Подключите стили кита и пакета один раз, в точке входа приложения:

```ts
import '@dskripchenko/ui/styles/all.css'
import '@dskripchenko/gantt/style.css'
```

Компоненты используют токены кита (`--uid-*`), поэтому светлая и тёмная темы
следуют за `data-theme` кита на `<html>`.

## Первая диаграмма

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

Полоса занимает дни `start` и `end` включительно. `progress` (0–1) рисуется
заливкой; `estimate` рисует полосу пунктиром; `tone` выбирает её цвет
(`accent`, `success`, `warning`, `danger`, `info`, `neutral`, `muted`). Строка
с `kind: 'group'` — строка-заголовок; в ней тоже могут быть вехи.

## Редактирование

Диаграмма никогда не меняет ваши данные. С `editable` человек перетаскивает
полосы (середина двигает всю полосу, край — этот конец) и вехи с привязкой к
дням; с `linkable` он рисует связи от круглой ручки на конце полосы и удаляет
их клавишей Delete. Каждое изменение приходит как `GanttChange`:

```vue
<GanttChart :rows="rows" :links="links" editable linkable :persist="save" />
```

```ts
import { applyChange, type GanttChange } from '@dskripchenko/gantt'

async function save(change: GanttChange) {
  await api.save(change) // бросьте исключение, чтобы отказать: диаграмма вернёт изменение назад
  model.value = applyChange(model.value, change)
}
```

С `persist` диаграмма сразу показывает изменение, держит его, пока выполняется
промис и пока не придут новые данные, и откатывает его (с событием `error`),
если промис отклонён. Без `persist` слушайте `change` и обновляйте строки сами.

Ctrl+Z / ⌘Z отменяет изменение, Ctrl+Shift+Z / ⌘⇧Z (или Ctrl+Y) повторяет
его — оба проходят через `persist`, как любое другое изменение.

## Дальше

- [Модель и ядро](model.md) — данные, шкалы, геометрия и изменения.
- [Компоненты Vue](vue.md) — свойства, события, слоты, клавиатура, темы, языки.
