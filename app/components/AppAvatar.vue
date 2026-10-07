<script setup lang="ts">
import { initials } from '~/utils/dates'

const props = withDefaults(defineProps<{
  /** Image URL — shows initials fallback when empty/null */
  src?: string | null
  /** Name used to derive initials when no image */
  name?: string | null
  /** Tailwind size classes, e.g. 'h-8 w-8' or 'h-16 w-16' */
  size?: string
  /** Border radius class — 'rounded-full' or 'rounded-2xl' */
  rounded?: string
}>(), {
  src: null,
  name: null,
  size: 'h-9 w-9',
  rounded: 'rounded-full'
})

const letters = computed(() => initials(props.name, 1))
</script>

<template>
  <img
    v-if="src"
    :src="src"
    alt=""
    class="shrink-0 object-cover"
    :class="[size, rounded]"
  />
  <span
    v-else
    class="grid shrink-0 place-items-center bg-primary/15 text-xs font-bold text-primary"
    :class="[size, rounded]"
  >
    {{ letters }}
  </span>
</template>
