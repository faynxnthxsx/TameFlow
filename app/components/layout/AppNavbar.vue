<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()

// Composable สิ่งที่สามารถนำมาประกอบเข้าด้วยกันได้
  const sidebarOpen = useState('tf-sidebar-open', () => false)

// Dashboard, company overview, invitations, chat, settings, profile, reports etc. don't need the search box.
const showSearch = computed(() => {
  const p = route.path
  // Only show exactly on Workspaces, Projects, and Activity root pages
  return p === '/workspaces' || p === '/projects' || p === '/activity'
})
// Signing out lives on the Settings page (Account section), not the navbar.
</script>

<template>
  <header
    class="sticky top-0 z-10 flex h-16 items-center gap-4 border-b border-border bg-navbar-bg px-4 sm:px-6"
  >
    <button
      type="button"
      class="grid h-9 w-9 shrink-0 place-items-center rounded-lg text-text-muted hover:bg-surface-alt hover:text-text lg:hidden"
      :aria-label="t('common.search')"
      @click="sidebarOpen = !sidebarOpen"
    >
      <AppIcon name="menu" class="h-5 w-5" />
    </button>

    <LayoutGlobalSearch v-if="showSearch" />

    <div class="flex flex-1 items-center justify-end gap-2 sm:gap-3">
      <LayoutLanguageSwitcher />
      <LayoutThemeSwitcher />
      <LayoutNotificationsBell />
    </div>
  </header>
</template>
