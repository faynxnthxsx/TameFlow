<script setup lang="ts">
const { t } = useI18n()
const route = useRoute()
const { profile, loadProfile } = useProfileState()

// Shared with the navbar hamburger; off-canvas drawer on mobile.
const open = useState('tf-sidebar-open', () => false)
watch(() => route.fullPath, () => (open.value = false))

// Items without `to` are placeholders for upcoming phases (shown dimmed).
const navItems = [
  { key: 'nav.dashboard', icon: 'dashboard', to: '/' },
  { key: 'nav.overview', icon: 'building', to: '/overview' },
  { key: 'nav.workspaces', icon: 'workspace', to: '/workspaces' },
  { key: 'nav.invitations', icon: 'mail', to: '/invitations' },
  { key: 'nav.chat', icon: 'chat', to: '/chat' },
  { key: 'nav.projects', icon: 'projects', to: '/projects' },
  { key: 'nav.calendar', icon: 'calendar', to: '/calendar' },
  { key: 'nav.activity', icon: 'activity', to: '/activity' },
  { key: 'nav.members', icon: 'members', to: '/members' },
  { key: 'nav.reports', icon: 'reports', to: '/reports' },
  { key: 'nav.settings', icon: 'settings', to: '/settings' }
] as const

function isActive(to: string) {
  return to === '/' ? route.path === '/' : route.path.startsWith(to)
}

// Footer profile card comes from the shared profile state, so it updates the
// instant the profile page saves a new name/avatar.
onMounted(() => {
  if (!profile.value.email) loadProfile()
})
</script>

<template>
  <div
    v-if="open"
    class="fixed inset-0 z-30 bg-black/50 lg:hidden"
    @click="open = false"
  />
  <aside
    class="fixed inset-y-0 left-0 z-40 flex w-64 shrink-0 -translate-x-full flex-col bg-sidebar-bg text-sidebar-text transition-transform duration-200 lg:static lg:translate-x-0"
    :class="{ 'translate-x-0': open }"
  >
    <div class="px-5 py-5">
      <BrandLogo :with-text="true" size="md" class="[&_span.text-text]:text-white" />
    </div>

    <nav class="flex-1 space-y-1 overflow-y-auto px-3 pb-4">
      <template v-for="item in navItems" :key="item.key">
        <NuxtLink
          v-if="item.to"
          :to="item.to"
          class="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors"
          :class="
            isActive(item.to)
              ? 'bg-primary text-white shadow-glow'
              : 'text-sidebar-text hover:bg-white/10 hover:text-sidebar-text-active'
          "
        >
          <AppIcon :name="item.icon" class="h-5 w-5 shrink-0" />
          <span>{{ t(item.key) }}</span>
        </NuxtLink>
        <span
          v-else
          class="flex cursor-not-allowed items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-sidebar-text/50"
        >
          <AppIcon :name="item.icon" class="h-5 w-5 shrink-0" />
          <span>{{ t(item.key) }}</span>
        </span>
      </template>
    </nav>

    <div class="border-t border-white/10 p-3">
      <NuxtLink
        to="/profile"
        class="flex items-center gap-3 rounded-lg px-2 py-2 transition-colors"
        :class="isActive('/profile') ? 'bg-white/10' : 'hover:bg-white/10'"
      >
        <img
          v-if="profile.avatar"
          :src="profile.avatar"
          alt=""
          class="h-9 w-9 rounded-full object-cover"
        />
        <div
          v-else
          class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-white/15 text-sm font-semibold text-white"
        >
          {{ (profile.name || '?').charAt(0).toUpperCase() }}
        </div>
        <div class="min-w-0 flex-1 leading-tight">
          <p class="truncate text-sm font-medium text-white">{{ profile.name || '—' }}</p>
          <p class="truncate text-xs text-sidebar-text/70">{{ profile.email }}</p>
        </div>
      </NuxtLink>
    </div>
  </aside>
</template>
