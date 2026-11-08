# 模型与核心

这里的一切都来自 `@dskripchenko/gantt`，无需 DOM 即可工作。

## 模型

```ts
interface GanttModel {
  rows: GanttRow[]
  links?: GanttLink[]
}

interface GanttRow {
  id: string
  kind?: 'row' | 'group'         // 分组是标题行
  label: string                  // 行的名称
  cells?: Record<string, string | number | null | undefined> // 表格列的值
  bars?: GanttBar[]
  milestones?: GanttMilestone[]
}

interface GanttBar {
  id: string
  start: ISODate                 // 第一天，'YYYY-MM-DD'
  end: ISODate                   // 最后一天，包含在内
  progress?: number              // 0–1
  tone?: Tone
  estimate?: boolean             // 虚线，无填充
  label?: string                 // 条形内的文字
  ariaLabel?: string
  locked?: boolean               // 不可拖动
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
  from: string                   // 条形 id：在前的那个
  to: string                     // 条形 id：在后的那个
  locked?: boolean
}
```

条形和里程碑的 id 在整个模型中唯一。`parseModel(json)` 读取不可信的 JSON：保留已知字段，
检查日期和 id，把进度限制在范围内，丢弃两端不是条形的连线，其余问题抛出 `GanttError`。

查找：`findBar`、`findMilestone`、`extentOf`（所有元素的第一天和最后一天）、
`isOverdue(bar, today)`、`durationOf(bar)`。

## 日期

日期以 ISO 字符串传递，按 UTC 自 1970-01-01 起的整天数计算，因此时区和夏令时永远不会让它们偏移：

```ts
toDay('2026-11-05')          // 20762
fromDay(20762)               // '2026-11-05'
addDays('2026-02-27', 2)     // '2026-03-01'
diffDays(a, b)
todayISO()                   // 查看者本地的日历日
startOfUnit(day, 'week')     // 默认周一；可传入 weekStartsOn
shiftUnits(day, 'month', -2)
```

## 刻度

缩放级别指定一列的单位：`day`、`week`、`month` 或 `quarter`。每个级别都有列上方的
分段带（日和周上方是月，月上方是季度，季度上方是年）、最小列宽和默认跨度。

```ts
const scale = createScale({ zoom: 'month', from: '2026-09-15', to: '2027-02-03', width: 900 })
scale.from, scale.to          // 对齐到整月：9 月 1 日 … 3 月 1 日（不含）
scale.columns                 // [{ start, end, x, width, bandStart }]
scale.dayWidth                // 填满 `width`，但不小于该缩放级别的最小值
xOf(scale, '2026-11-05')
dayAt(scale, x)
snapDays(scale, dx)           // 以整天计的拖动距离
rangeFor('month', today, extentOf(model)) // 围绕今天和数据的默认范围
```

## 几何计算

```ts
barSpan(scale, bar)           // 按整天计算的 { x, width }
milestoneX(scale, date)       // 所在那一天的中点
barBoxes(model, scale, rowHeight, barHeight) // 条形矩形的 Map
linkRoute(fromBox, toBox)     // 直角折线的点：从末端出，进入起点
pathOf(points, radius)        // 带圆角的 SVG 路径
```

## 改动与历史

```ts
type GanttChange =
  | { kind: 'bar'; id; rowId; from: { start, end }; to: { start, end } }
  | { kind: 'milestone'; id; rowId; from: ISODate; to: ISODate }
  | { kind: 'link-add'; link: GanttLink }
  | { kind: 'link-remove'; link: GanttLink }
```

- `dragDates(bar, 'move' | 'start' | 'end', days)` —— 拖动后的日期；一端永远不会越过
  另一端，所以条形至少保留一天。
- `applyChange(model, change)` —— 应用改动后的新模型；旧模型保持不变。改动不匹配时
  抛出 `ChangeError`（条形不在 `from` 所说的位置、连线已存在、连线会形成环）。
- `invertChange(change)` —— 它的精确逆操作。
- `linkRefusal(model, from, to)` —— `'self'`、`'unknown'`、`'duplicate'`、
  `'cycle'` 或 `null`。
- `History` —— `push`、`undo`、`redo`、`peekUndo`、`peekRedo`、`canUndo`、
  `canRedo`、`clear`，带 `limit`（默认 100）。它保存的是改动而不是模型：宿主的数据
  始终是唯一的事实来源。
