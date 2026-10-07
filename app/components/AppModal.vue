<script setup lang="ts">
defineProps<{
  /** Controls visibility */
  show: boolean
  /** Max width class, e.g. 'max-w-sm', 'max-w-lg' */
  maxWidth?: string
}>()

const emit = defineEmits<{ close: [] }>()
</script>

<template>
  <Teleport to="body">
    <div v-if="show" class="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div class="absolute inset-0 bg-text/50 backdrop-blur-sm" @click="emit('close')" />
      <div
        class="relative w-full rounded-2xl bg-surface p-6 shadow-modal"
        :class="maxWidth ?? 'max-w-sm'"
      >
        <slot />
      </div>
    </div>
  </Teleport>
</template>
