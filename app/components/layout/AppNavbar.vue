<script setup lang="ts">
const { t } = useI18n()
const user = useSupabaseUser()
const supabase = useSupabaseClient()

async function logout() {
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <header class="flex h-16 items-center justify-between border-b border-border bg-navbar-bg px-6 shadow-card">
    <span class="text-lg font-semibold text-text">{{ t('common.appName') }}</span>
    <div class="flex items-center gap-4">
      <LayoutLanguageSwitcher />
      <LayoutThemeSwitcher />
      <button
        v-if="user"
        type="button"
        class="rounded-md px-3 py-1.5 text-sm text-text-muted hover:bg-surface-alt hover:text-text"
        @click="logout"
      >
        {{ t('nav.logout') }}
      </button>
    </div>
  </header>
</template>
