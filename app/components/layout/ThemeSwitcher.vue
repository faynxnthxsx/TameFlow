<script setup lang="ts">
const { theme, THEMES, isDark, setTheme } = useTheme()
const { t } = useI18n()
</script>

<template>
  <div
    class="relative grid grid-cols-2 rounded-full border border-border bg-surface-alt p-1 text-xs font-medium"
  >
    <!-- sliding active pill -->
    <span
      class="pointer-events-none absolute bottom-1 top-1 w-[calc(50%-0.25rem)] rounded-full bg-surface shadow-sm transition-[left] duration-200 ease-out"
      :style="isDark ? 'left: 50%' : 'left: 0.25rem'"
    />
    <button
      v-for="item in THEMES"
      :key="item.id"
      type="button"
      class="relative z-10 rounded-full px-3 py-1 text-center transition-colors"
      :class="theme === item.id ? 'text-text' : 'text-text-muted hover:text-text'"
      @click="setTheme(item.id)"
    >
      {{ t(item.labelKey) }}
    </button>
  </div>
</template>
