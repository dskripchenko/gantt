<script setup lang="ts">
/**
 * The playground: a product plan around a fixed "today" — editable, with
 * links (a change to "Failover" is refused after a moment, so the rollback
 * can be seen). ?view=readonly | empty, ?theme=dark, ?locale=ru, ?zoom=week|month|quarter.
 */
import { ref } from 'vue'
import { GanttChart, GanttLegend, GanttZoom, type OpenTarget } from '../src/vue'
import { applyChange, type GanttChange, type GanttModel, type Zoom } from '../src/index'
import { TODAY, plan } from '../tests/fixtures/plan'

const params = new URLSearchParams(location.search)
const view = params.get('view') ?? 'edit'
const locale = params.get('locale') === 'ru' ? 'ru' : 'en'
const zoom = ref<Zoom>((params.get('zoom') as Zoom | null) ?? 'month')
const model = ref<GanttModel>(view === 'empty' ? { rows: [] } : plan)
const events = ref<string[]>([])

const columns = [
  { key: 'key', label: locale === 'ru' ? 'Ключ' : 'Key', width: '72px' },
  { key: 'label', label: locale === 'ru' ? 'Работа' : 'Work', width: 'minmax(0, 1fr)', main: true },
  { key: 'status', label: locale === 'ru' ? 'Статус' : 'Status', width: '96px' },
  { key: 'progress', label: locale === 'ru' ? 'Прогресс' : 'Progress', width: '64px', align: 'end' as const },
]

function log(line: string) {
  events.value = [line, ...events.value].slice(0, 5)
}

/** A fake server: saves after 300 ms, refuses any change to bar B. */
async function persist(change: GanttChange): Promise<void> {
  await new Promise((r) => setTimeout(r, 300))
  if (change.kind === 'bar' && change.id === 'B') throw new Error('Failover is frozen')
  model.value = applyChange(model.value, change)
}

function onOpen(target: OpenTarget) {
  log(`open ${target.kind} ${target.id}`)
}
</script>

<template>
  <div class="pg">
    <header class="pg-head">
      <h1>{{ locale === 'ru' ? 'План' : 'Plan' }}</h1>
      <GanttZoom
        v-model="zoom"
        :locale="locale"
      />
    </header>
    <GanttChart
      class="pg-chart"
      :rows="model.rows"
      :links="model.links"
      :columns="columns"
      :zoom="zoom"
      :today="TODAY"
      :editable="view !== 'readonly'"
      :linkable="view !== 'readonly'"
      :persist="persist"
      :table-width="460"
      :locale="locale"
      @open="onOpen"
      @change="(c) => log(`change ${c.kind}`)"
      @error="(f) => log(`refused: ${(f.error as Error).message}`)"
    />
    <GanttLegend
      class="pg-legend"
      :items="[
        { kind: 'bar', label: locale === 'ru' ? 'прогресс' : 'progress' },
        { kind: 'bar', tone: 'danger', label: locale === 'ru' ? 'просрочено' : 'overdue' },
        { kind: 'estimate', label: locale === 'ru' ? 'оценка' : 'estimate' },
        { kind: 'milestone', label: locale === 'ru' ? 'выпуск' : 'release' },
      ]"
      :hint="locale === 'ru' ? 'Тяните край полосы, чтобы сдвинуть срок' : 'Drag an edge of a bar to change its dates'"
    />
    <ol
      class="pg-log"
      data-test="log"
    >
      <li
        v-for="(e, i) in events"
        :key="i"
      >
        {{ e }}
      </li>
    </ol>
  </div>
</template>

<style>
body {
  margin: 0;
  background: var(--uid-surface-base);
  color: var(--uid-text-primary);
  font-family: var(--uid-font-family-sans);
}
.pg {
  display: flex;
  flex-direction: column;
  gap: 12px;
  height: 100vh;
  padding: 16px 24px;
  box-sizing: border-box;
}
.pg-head {
  display: flex;
  align-items: center;
  gap: 12px;
}
.pg-head h1 {
  flex: 1;
  margin: 0;
  font-size: 22px;
}
.pg-chart {
  flex: 1 1 0;
  min-height: 0;
}
.pg-log {
  margin: 0;
  padding-left: 20px;
  font-size: 12px;
  color: var(--uid-text-secondary);
  min-height: 3em;
}
@media (max-width: 640px) {
  .pg {
    padding: 12px 16px;
  }
}
</style>
