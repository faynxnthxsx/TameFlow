<script setup lang="ts">
const { t } = useI18n()
</script>

<template>
  <div class="flex min-h-screen flex-col bg-bg">
    <header class="flex h-16 items-center justify-between px-6">
      <span class="text-lg font-semibold text-text">{{ t('common.appName') }}</span>
      <div class="flex items-center gap-4">
        <LayoutLanguageSwitcher />
        <LayoutThemeSwitcher />
      </div>
    </header>
    <main class="flex flex-1 items-center justify-center p-6">
      <slot />
    </main>
  </div>
</template>
