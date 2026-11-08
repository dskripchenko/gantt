/**
 * @dskripchenko/gantt/vue — the chart, the scale switch and the legend,
 * built on @dskripchenko/ui. Import the styles once: `@dskripchenko/gantt/style.css`.
 */
import './gantt.css'

export { default as GanttChart, type GanttColumn, type OpenTarget, type ChangeFailure, type PersistChange } from './GanttChart.vue'
export { default as GanttZoom } from './GanttZoom.vue'
export { default as GanttLegend, type LegendItem } from './GanttLegend.vue'
export { en, ru, LOCALES, resolveLabels, type GanttLabels } from './labels'
export { formatDate, headerCell, monthName, type HeaderCell } from './format'
