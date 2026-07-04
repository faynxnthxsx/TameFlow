<script setup lang="ts">
const { theme, THEMES, setTheme } = useTheme()
const { t } = useI18n()
</script>

<template>
  <label class="flex items-center gap-2 text-sm text-text-muted">
    <span>{{ t('theme.label') }}</span>
    <select
      :value="theme"
      class="rounded-md border border-border bg-surface px-2 py-1 text-text"
      @change="setTheme(($event.target as HTMLSelectElement).value as typeof theme)"
    >
      <option v-for="item in THEMES" :key="item.id" :value="item.id">
        {{ t(item.labelKey) }}
      </option>
    </select>
  </label>
</template>
