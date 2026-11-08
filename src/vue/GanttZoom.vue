<script setup lang="ts">
/**
 * The scale switch: one choice of the zooms given, as a radio group
 * (arrows move the choice). Its labels come from the package's dictionary
 * unless the host names them.
 */
import { computed } from 'vue'
import type { Zoom } from '../index'
import { resolveLabels, type GanttLabels } from './labels'
import { useLocaleScope } from './localeScope'

const props = withDefaults(
  defineProps<{
    zooms?: Zoom[]
    locale?: string
    labels?: Partial<GanttLabels>
  }>(),
  { zooms: () => ['week', 'month', 'quarter'] },
)
const model = defineModel<Zoom>({ default: 'month' })

const { lang } = useLocaleScope(() => props.locale)
const t = computed(() => resolveLabels(lang.value, props.labels))

function onKey(e: KeyboardEvent) {
  if (!['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(e.key)) return
  e.preventDefault()
  const i = props.zooms.indexOf(model.value)
  const step = e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? -1 : 1
  const next = props.zooms[(i + step + props.zooms.length) % props.zooms.length]
  if (next) {
    model.value = next
    const target = (e.currentTarget as HTMLElement).querySelector<HTMLElement>(`[data-zoom="${next}"]`)
    target?.focus()
  }
}
</script>

<template>
  <div
    class="gt-zoom"
    role="radiogroup"
    :aria-label="t.zoom"
    @keydown="onKey"
  >
    <button
      v-for="z in zooms"
      :key="z"
      type="button"
      role="radio"
      class="gt-zoom__item"
      :data-zoom="z"
      :aria-checked="model === z"
      :tabindex="model === z ? 0 : -1"
      @click="model = z"
    >
      {{ t.zooms[z] }}
    </button>
  </div>
</template>
