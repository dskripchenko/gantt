# @dskripchenko/gantt

## 0.1.0

The first release.

- A zero-dependency TypeScript core: the model (rows and group rows, bars,
  milestones, links) with strict parsing; calendar days in UTC; time scales
  of day, week, month and quarter columns; geometry of bars, milestones and
  link routes; changes with exact inverses and an undo history.
- `GanttChart` for Vue 3 on `@dskripchenko/ui`: a sticky table with columns
  and slots, a two-level header, progress, estimates, tones, milestones,
  links and the today line; dragging bars, edges and milestones with
  snapping; drawing and removing links; optimistic saving with rollback;
  undo and redo; keyboard editing and ARIA; a compact table on phones;
  light and dark themes; English and Russian.
- `GanttZoom` and `GanttLegend`.
