<script setup lang="ts">
const { t } = useI18n()

const navItems = [
  { key: 'nav.dashboard', icon: '\u{1F4CA}' },
  { key: 'nav.workspaces', icon: '\u{1F4C1}' },
  { key: 'nav.projects', icon: '\u{1F4CB}' },
  { key: 'nav.calendar', icon: '\u{1F4C5}' },
  { key: 'nav.notifications', icon: '\u{1F514}' }
]
</script>

<template>
  <aside class="flex w-60 flex-col gap-1 bg-sidebar-bg p-4">
    <span
      v-for="item in navItems"
      :key="item.key"
      class="flex cursor-pointer items-center gap-2 rounded-md px-3 py-2 text-sidebar-text hover:text-sidebar-text-active"
    >
      <span>{{ item.icon }}</span>
      <span>{{ t(item.key) }}</span>
    </span>
  </aside>
</template>
