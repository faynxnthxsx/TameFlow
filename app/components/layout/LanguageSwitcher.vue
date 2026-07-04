<script setup lang="ts">
import { SUPPORTED_LOCALES, type LocaleId } from '~/composables/useLocalePreference'

const { locale, setPreferredLocale } = useLocalePreference()
const { t } = useI18n()
</script>

<template>
  <label class="flex items-center gap-2 text-sm text-text-muted">
    <span>{{ t('language.label') }}</span>
    <select
      :value="locale"
      class="rounded-md border border-border bg-surface px-2 py-1 text-text"
      @change="setPreferredLocale(($event.target as HTMLSelectElement).value as LocaleId)"
    >
      <option v-for="code in SUPPORTED_LOCALES" :key="code" :value="code">
        {{ t(`language.${code}`) }}
      </option>
    </select>
  </label>
</template>
