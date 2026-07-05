<script setup lang="ts">
const { t } = useI18n()
const user = useSupabaseUser()
const supabase = useSupabaseClient()

const sidebarOpen = useState('tf-sidebar-open', () => false)

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

    <div class="relative hidden max-w-sm flex-1 items-center sm:flex">
      <AppIcon name="search" class="pointer-events-none absolute left-3 h-4 w-4 text-text-muted" />
      <input
        type="text"
        :placeholder="`${t('common.search')}...`"
        class="w-full rounded-lg border border-border bg-surface-alt py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:bg-surface focus:outline-none"
      />
    </div>

    <div class="flex flex-1 items-center justify-end gap-2 sm:gap-3">
      <LayoutLanguageSwitcher />
      <LayoutThemeSwitcher />

      <button
        type="button"
        class="relative grid h-9 w-9 place-items-center rounded-lg text-text-muted hover:bg-surface-alt hover:text-text"
        :aria-label="t('nav.notifications')"
      >
        <AppIcon name="bell" class="h-5 w-5" />
      </button>

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
