<script setup lang="ts">
/**
 * A legend under a chart: swatches drawn the way the chart draws them (a
 * bar of a tone, a dashed estimate, a milestone, the today line) and an
 * optional hint at the end of the line.
 */
import type { Tone } from '../index'

export interface LegendItem {
  kind: 'bar' | 'estimate' | 'milestone' | 'today'
  label: string
  tone?: Tone
}

defineProps<{
  items: LegendItem[]
  hint?: string
}>()
</script>

<template>
  <div class="gt-legend">
    <span
      v-for="item in items"
      :key="`${item.kind}-${item.label}`"
      class="gt-legend__item"
      :class="`gt-tone--${item.tone ?? (item.kind === 'today' ? 'danger' : item.kind === 'milestone' ? 'neutral' : 'accent')}`"
    >
      <span
        v-if="item.kind === 'bar' || item.kind === 'estimate'"
        class="gt-legend__bar"
        :class="{ 'is-estimate': item.kind === 'estimate' }"
        aria-hidden="true"
      />
      <span
        v-else-if="item.kind === 'milestone'"
        class="gt-legend__diamond"
        aria-hidden="true"
      />
      <span
        v-else
        class="gt-legend__line"
        aria-hidden="true"
      />
      {{ item.label }}
    </span>
    <span
      v-if="hint"
      class="gt-legend__hint"
    >{{ hint }}</span>
  </div>
</template>
