<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="rounded-lg border border-border bg-surface p-6 shadow-card">
    <h1 class="text-xl font-semibold text-text">{{ t('common.appName') }}</h1>
    <p class="mt-2 text-text-muted">Phase 0 foundation shell — theme and language switch instantly.</p>
  </div>
</template>
