# 快速上手

## 安装

```bash
npm install @dskripchenko/gantt
```

本包有两个入口：

- `@dskripchenko/gantt` —— 核心：模型、日历日、时间刻度、几何计算和可撤销的改动。
  纯 TypeScript，没有任何依赖，也不依赖 DOM；可在浏览器、Node 20+ 和 worker 中运行。
- `@dskripchenko/gantt/vue` —— `GanttChart`、`GanttZoom` 和 `GanttLegend`。
  它们需要 Vue 3.4+ 和 [`@dskripchenko/ui`](https://github.com/dskripchenko/ui)
  1.35+，二者声明为可选的 peer 依赖。

```bash
npm install vue @dskripchenko/ui            # 用于组件
```

## 样式

在应用入口处一次性引入 kit 的样式和本包的样式：

```ts
import '@dskripchenko/ui/styles/all.css'
import '@dskripchenko/gantt/style.css'
```

组件使用 kit 的设计令牌（`--uid-*`），因此浅色和深色主题跟随 `<html>` 上 kit 的
`data-theme`。

## 第一张图表

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

条形覆盖 `start` 和 `end` 两天，两端都包含在内。`progress`（0–1）绘制为填充；
`estimate` 把条形画成虚线；`tone` 选择它的颜色（`accent`、`success`、`warning`、
`danger`、`info`、`neutral`、`muted`）。`kind: 'group'` 的行是标题行；它也可以包含里程碑。

## 编辑

图表从不修改你的数据。开启 `editable` 后，用户可以拖动条形（拖中间移动整个条形，
拖边缘移动对应的一端）和里程碑，并对齐到天；开启 `linkable` 后，用户可以从条形末端的
圆形手柄拖出连线，并用 Delete 删除。每个改动都以 `GanttChange` 的形式发出：

```vue
<GanttChart :rows="rows" :links="links" editable linkable :persist="save" />
```

```ts
import { applyChange, type GanttChange } from '@dskripchenko/gantt'

async function save(change: GanttChange) {
  await api.save(change) // 抛出异常即拒绝：图表会撤回这个改动
  model.value = applyChange(model.value, change)
}
```

有 `persist` 时，图表立即显示改动，在 promise 执行期间以及新数据到来之前保留它，
promise 被拒绝时回滚（并触发 `error` 事件）。没有 `persist` 时，监听 `change`，
自己更新行数据。

Ctrl+Z / ⌘Z 撤销改动，Ctrl+Shift+Z / ⌘⇧Z（或 Ctrl+Y）重做——两者都和其他改动一样
经过 `persist`。

## 下一步

- [模型与核心](model.md) —— 数据、刻度、几何计算和改动。
- [Vue 组件](vue.md) —— prop、事件、插槽、键盘、主题、语言。
