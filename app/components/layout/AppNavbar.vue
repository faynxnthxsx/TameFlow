<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()

const sidebarOpen = useState('tf-sidebar-open', () => false)

// Dashboard, company overview and invitations don't need the search box.
const showSearch = computed(() => !['/', '/overview', '/invitations'].includes(route.path))
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
