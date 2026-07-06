<script setup lang="ts">
const { t } = useI18n()
const user = useSupabaseUser()
const supabase = useSupabaseClient()
const route = useRoute()

const sidebarOpen = useState('tf-sidebar-open', () => false)

// Dashboard, company overview and invitations don't need the search box.
const showSearch = computed(() => !['/', '/overview', '/invitations'].includes(route.path))

async function logout() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}
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

      <button
        v-if="user"
        type="button"
        class="flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-medium text-text-muted hover:bg-surface-alt hover:text-text"
        @click="logout"
      >
        <AppIcon name="logout" class="h-4 w-4" />
        <span class="hidden sm:inline">{{ t('nav.logout') }}</span>
      </button>
    </div>
  </header>
</template>
