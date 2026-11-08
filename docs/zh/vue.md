# Vue 组件

```ts
import { GanttChart, GanttZoom, GanttLegend } from '@dskripchenko/gantt/vue'
import '@dskripchenko/gantt/style.css'
```

## GanttChart

左侧是行组成的表格，右侧是时间刻度，二者在同一个滚动区域中：时间轴滚动时，表格和
表头保持不动。图表会填满父元素的高度；请给父元素（或图表）设置高度。

### Prop

| Prop | 类型 | 默认值 | |
|---|---|---|---|
| `rows` | `GanttRow[]` | — | 行和分组行 |
| `links` | `GanttLink[]` | `[]` | 从一个条形末端指向另一个条形起点的箭头 |
| `columns` | `GanttColumn[]` | 名称列 | 表格列：`{ key, label, width?, main?, align? }`；`width` 是网格轨道（`84px`、`minmax(0, 1fr)`）；`main` 列显示 `row.label`，分组名称从这一列开始 |
| `zoom` | `'day' \| 'week' \| 'month' \| 'quarter'` | `'month'` | 一列的单位 |
| `from`、`to` | `ISODate` | 围绕今天和数据 | 显示的范围；对齐到整列 |
| `today` | `ISODate` | 查看者的今天 | 今天线的位置 |
| `showToday` | `boolean` | `true` | |
| `editable` | `boolean` | `false` | 拖动条形、其边缘和里程碑；方向键 |
| `linkable` | `boolean` | `false` | 从条形末端手柄拖出连线；Delete 删除连线 |
| `persist` | `(change) => unknown` | — | 保存改动；promise 被拒绝时撤回 |
| `rowHeight`、`barHeight`、`headerHeight` | `number` | `40`、`20`、`48` | 像素 |
| `tableWidth` | `number` | `360` | 像素 |
| `compactBelow`、`compactTableWidth` | `number` | `640`、`150` | 图表宽度低于此值时，表格只保留主列 |
| `weekStartsOn` | `number` | `1` | 0 周日 … 6 周六 |
| `locale` | `string` | kit 的语言 | `en`、`ru` 或宿主的语言 |
| `labels` | `Partial<GanttLabels>` | — | 覆盖任意文本 |
| `ariaLabel` | `string` | "Timeline" | |

### 事件

- `change(change: GanttChange)` —— 用户做出的每个改动，包括撤销和重做。
- `error({ change, error })` —— `persist` 被拒绝；改动已撤回。
- `open({ kind: 'bar' | 'milestone' | 'row', id, rowId })` —— 没有拖动的点击、
  在条形或里程碑上按 Enter，或点击主单元格。

### 插槽

- `cell` `{ row, column, value }` —— 表格单元格（状态标签、链接）。
- `group` `{ row }` —— 分组行的名称。
- `header-cell` `{ column }` —— 列标题。
- `empty` —— 没有行时显示。

### 对外暴露

`undo()`、`redo()`、`canUndo`、`canRedo`、`scrollToDate(date, 'start' |
'center')`、`scrollToToday()`。图表在挂载时和缩放级别变化时会滚动到今天。

### 鼠标、触摸和键盘

- 拖动条形可移动它，拖动边缘可移动一端，拖动里程碑可移动它；提示框显示日期。
  一切都对齐到天。
- 从条形后面的圆形手柄拖到另一个条形上即可连接它们；连向自身、重复和成环的连线
  会被拒绝并给出提示。
- 拖动空白背景可平移（鼠标）；其他情况照常滚动。
- 条形和里程碑是 Tab 顺序中的按钮。← / → 移动一天（按住 Shift：一周），
  Alt+← / → 移动末端，Alt+Shift+← / → 移动起点，Enter 打开。获得焦点的连线用
  Delete 删除。Ctrl/⌘+Z 撤销，Ctrl/⌘+Shift+Z 或 Ctrl+Y 重做。
- 图表是一个 `grid`；每个条形的名称会说明它所在的行、日期、进度、是否为估计以及
  时长；改动会在 live region 中播报。

### 主题

颜色来自 kit 的设计令牌，所以 `data-theme="dark"` 直接可用。`.gt` 上的 `--gt-*`
变量可以覆盖它们：`--gt-bg`、`--gt-group-bg`、`--gt-border`、`--gt-line`、
`--gt-text`、`--gt-muted`、`--gt-faint`、`--gt-today`、`--gt-link`、
`--gt-focus`、`--gt-radius`。

## GanttZoom

缩放级别的单选组，配合 `v-model` 使用：

```vue
<GanttZoom v-model="zoom" :zooms="['week', 'month', 'quarter']" />
```

名称来自 `labels.zooms`（默认 Weeks、Months、Quarters）；按跨度思考的宿主可以传入
自己的名称：`{ week: 'Month', month: 'Quarter',
quarter: 'Year' }`。

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

## 语言

包内自带英语和俄语（`en`、`ru`、`LOCALES`）。图表跟随自己的 `locale` prop，否则跟随
上层 `UidLocaleProvider` 提供的 kit 语言。任何文本都可以用 `labels` 替换；日期和月份名称
用 `Intl` 按图表的语言格式化。
