<script setup lang="ts">
// The navbar bell surfaces pending workspace invitations — the one piece of
// real, actionable "you have something waiting" state the app produces.
const { t, locale } = useI18n()
const supabase = useSupabaseClient()

interface Invite {
  id: string
  workspace_name: string
  role: string
  created_at: string
}

const invitations = ref<Invite[]>([])
const open = ref(false)
const root = ref<HTMLElement | null>(null)
onClickOutside(root, () => (open.value = false))

async function load() {
  const { data } = await supabase.rpc('my_invitations')
  invitations.value = (data ?? []) as Invite[]
}
onMounted(load)

// Refresh when the dropdown is opened so it reflects freshly accepted/declined.
watch(open, (o) => {
  if (o) load()
})

const count = computed(() => invitations.value.length)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value, { day: 'numeric', month: 'short' })
}

const ROLE_BADGE: Record<string, string> = {
  admin: 'bg-info/10 text-info',
  member: 'bg-surface-alt text-text',
  viewer: 'bg-surface-alt text-text-muted'
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="relative grid h-9 w-9 place-items-center rounded-lg text-text-muted transition hover:bg-surface-alt hover:text-text"
      :class="{ 'bg-surface-alt text-text': open }"
      :aria-label="t('nav.notifications')"
      @click="open = !open"
    >
      <AppIcon name="bell" class="h-5 w-5" />
      <span
        v-if="count"
        class="absolute -right-0.5 -top-0.5 grid h-4 min-w-4 place-items-center rounded-full bg-danger px-1 text-[10px] font-bold text-primary-fg ring-2 ring-navbar-bg"
      >
        {{ count }}
      </span>
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="open"
        class="absolute right-0 z-20 mt-2 w-80 overflow-hidden rounded-xl border border-border bg-surface shadow-modal"
      >
        <div class="flex items-center justify-between border-b border-border px-4 py-3">
          <h3 class="text-sm font-semibold text-text">{{ t('notifications.title') }}</h3>
          <span
            v-if="count"
            class="rounded-full bg-primary/10 px-2 py-0.5 text-xs font-semibold text-primary"
          >
            {{ count }}
          </span>
        </div>

        <!-- Empty -->
        <div v-if="count === 0" class="flex flex-col items-center gap-2 px-4 py-8 text-center">
          <span class="grid h-11 w-11 place-items-center rounded-full bg-success/10 text-success">
            <AppIcon name="check" class="h-5 w-5" />
          </span>
          <p class="text-sm text-text-muted">{{ t('notifications.empty') }}</p>
        </div>

        <template v-else>
          <p class="px-4 pb-1 pt-3 text-xs font-medium uppercase tracking-wide text-text-muted">
            {{ t('notifications.invitationsHeading') }}
          </p>
          <ul class="max-h-72 overflow-auto px-2 pb-1">
            <li v-for="inv in invitations" :key="inv.id">
              <NuxtLink
                to="/invitations"
                class="flex items-start gap-3 rounded-lg p-2 transition hover:bg-surface-alt"
                @click="open = false"
              >
                <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <AppIcon name="mail" class="h-4 w-4" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm font-medium text-text">{{ inv.workspace_name }}</p>
                  <p class="mt-0.5 flex items-center gap-1.5 text-xs text-text-muted">
                    {{ t('invite.invitedAs') }}
                    <span class="rounded-full px-1.5 py-0.5 font-medium" :class="ROLE_BADGE[inv.role]">
                      {{ t(`role.${inv.role}`) }}
                    </span>
                  </p>
                </div>
                <span class="shrink-0 text-xs text-text-muted">{{ formatDate(inv.created_at) }}</span>
              </NuxtLink>
            </li>
          </ul>
          <NuxtLink
            to="/invitations"
            class="block border-t border-border px-4 py-2.5 text-center text-sm font-medium text-primary transition hover:bg-surface-alt"
            @click="open = false"
          >
            {{ t('notifications.viewAll') }}
          </NuxtLink>
        </template>
      </div>
    </Transition>
  </div>
</template>
