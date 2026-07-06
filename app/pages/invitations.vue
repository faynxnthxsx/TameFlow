<script setup lang="ts">
const { t, locale } = useI18n()
const supabase = useSupabaseClient()

const { data, pending, refresh } = await useAsyncData(
  'my-invitations',
  async () => {
    const { data, error } = await supabase.rpc('my_invitations')
    if (error) throw error
    return data ?? []
  },
  { lazy: true }
)

const busyId = ref<string | null>(null)
const errorMsg = ref('')
const showFaq = ref(false)

async function accept(id: string) {
  busyId.value = id
  errorMsg.value = ''
  const { data: workspaceId, error } = await supabase.rpc('accept_invitation', {
    invitation_id: id
  })
  busyId.value = null
  if (error) {
    errorMsg.value = t('error.generic')
    return
  }
  await navigateTo(`/workspaces/${workspaceId}`)
}

async function decline(id: string) {
  busyId.value = id
  errorMsg.value = ''
  const { error } = await supabase.rpc('decline_invitation', { invitation_id: id })
  busyId.value = null
  if (error) {
    errorMsg.value = t('error.generic')
    return
  }
  await refresh()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value)
}

const ROLE_BADGE_CLASSES: Record<string, string> = {
  owner: 'bg-primary text-primary-fg',
  admin: 'bg-info text-text-inverse',
  member: 'bg-surface-alt text-text',
  viewer: 'bg-surface-alt text-text-muted'
}

// The three how-it-works steps, tinted like the design.
const STEPS = [
  { icon: 'user-plus', tint: 'bg-primary/10 text-primary', key: 'step1' },
  { icon: 'check', tint: 'bg-success/10 text-success', key: 'step2' },
  { icon: 'members', tint: 'bg-brand-accent/10 text-brand-accent', key: 'step3' }
] as const
</script>

<template>
  <div class="mx-auto max-w-5xl">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-text">{{ t('invite.myTitle') }}</h1>
        <p class="mt-1 text-sm text-text-muted">{{ t('invite.mySubtitle') }}</p>
      </div>
      <button
        type="button"
        class="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2 text-sm font-medium text-text-muted shadow-card transition hover:text-text"
        @click="showFaq = true"
      >
        <AppIcon name="help" class="h-4 w-4" />
        {{ t('invite.faq') }}
      </button>
    </div>

    <p v-if="pending" class="mt-10 text-center text-text-muted">{{ t('common.loading') }}</p>

    <template v-else>
      <p v-if="errorMsg" class="mt-4 text-sm text-danger">{{ errorMsg }}</p>

      <!-- Empty state -->
      <div
        v-if="!data || data.length === 0"
        class="flex min-h-[62vh] flex-col items-center justify-center px-6 text-center"
      >
        <!-- Envelope illustration -->
        <svg
          viewBox="0 0 240 170"
          class="h-32 w-48 text-primary"
          fill="none"
          aria-hidden="true"
        >
          <!-- clouds -->
          <g class="text-primary" fill="currentColor" opacity="0.12">
            <path d="M40 54c-6 0-10 4-10 9 0 5 4 8 9 8h20c5 0 9-3 9-8s-5-9-11-8c-1-6-9-8-13-4a8 8 0 0 0-4-5z" />
            <path d="M186 40c-5 0-8 3-8 7 0 4 3 7 7 7h16c4 0 7-3 7-7s-4-7-9-6c-1-5-7-7-11-3a6 6 0 0 0-4-5z" />
          </g>
          <!-- sparkles -->
          <g class="text-brand-accent" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" opacity="0.7">
            <path d="M64 96v10M59 101h10" />
            <path d="M198 104v8M194 108h8" />
            <path d="M176 132v6M173 135h6" />
          </g>
          <!-- envelope body -->
          <rect x="70" y="66" width="100" height="70" rx="10" class="text-primary" fill="currentColor" opacity="0.1" />
          <rect x="70" y="66" width="100" height="70" rx="10" stroke="currentColor" stroke-width="3" />
          <!-- flap -->
          <path d="M74 74l46 32 46-32" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" />
          <!-- person-plus badge -->
          <circle cx="120" cy="100" r="17" class="text-surface" fill="currentColor" />
          <g class="text-primary" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" fill="none">
            <circle cx="120" cy="95" r="4.5" />
            <path d="M112 110a8 8 0 0 1 16 0" />
          </g>
          <!-- paper plane + trail -->
          <path d="M150 40l-40 14 15 6 3 14 8-10 18 6z" class="text-primary" fill="currentColor" opacity="0.9" />
          <path d="M92 70c8-10 22-16 34-14" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-dasharray="1 8" opacity="0.5" />
        </svg>

        <h2 class="mt-6 text-xl font-bold text-text">{{ t('invite.emptyTitle') }}</h2>
        <p class="mx-auto mt-2 max-w-md text-sm text-text-muted">{{ t('invite.emptySubtitle') }}</p>

        <NuxtLink
          to="/workspaces"
          class="mt-6 inline-flex items-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg shadow-card transition hover:bg-primary-hover"
        >
          <AppIcon name="user-plus" class="h-5 w-5" />
          {{ t('invite.createOwn') }}
        </NuxtLink>
      </div>

      <!-- Invitation list -->
      <ul v-else class="mt-6 flex flex-col gap-3">
        <li
          v-for="invite in data"
          :key="invite.id"
          class="flex flex-wrap items-center justify-between gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card"
        >
          <div class="flex items-center gap-3">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <AppIcon name="mail" class="h-5 w-5" />
            </span>
            <div>
              <p class="font-semibold text-text">{{ invite.workspace_name }}</p>
              <p class="mt-1 text-sm text-text-muted">
                {{ t('invite.invitedAs') }}
                <span
                  class="ml-1 rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="ROLE_BADGE_CLASSES[invite.role]"
                >
                  {{ t(`role.${invite.role}`) }}
                </span>
                &middot; {{ formatDate(invite.created_at) }}
              </p>
            </div>
          </div>
          <div class="flex items-center gap-2">
            <button
              type="button"
              :disabled="busyId === invite.id"
              class="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-60"
              @click="accept(invite.id)"
            >
              {{ t('invite.accept') }}
            </button>
            <button
              type="button"
              :disabled="busyId === invite.id"
              class="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted hover:text-text disabled:opacity-60"
              @click="decline(invite.id)"
            >
              {{ t('invite.decline') }}
            </button>
          </div>
        </li>
      </ul>

    </template>

    <!-- FAQ / how-it-works popup -->
    <Teleport to="body">
      <div v-if="showFaq" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-text/50 backdrop-blur-sm" @click="showFaq = false" />
        <div class="relative w-full max-w-lg rounded-2xl bg-surface p-6 shadow-modal">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <span class="grid h-11 w-11 place-items-center rounded-xl bg-primary/10 text-primary">
                <AppIcon name="help" class="h-5 w-5" />
              </span>
              <h2 class="text-lg font-bold text-text">{{ t('invite.howTitle') }}</h2>
            </div>
            <button
              type="button"
              class="rounded-lg p-1 text-text-muted transition hover:bg-surface-alt hover:text-text"
              @click="showFaq = false"
            >
              <AppIcon name="x" class="h-5 w-5" />
            </button>
          </div>

          <div class="mt-5 flex flex-col gap-5">
            <div v-for="(step, i) in STEPS" :key="step.key" class="flex gap-3">
              <span
                class="grid h-10 w-10 shrink-0 place-items-center rounded-full"
                :class="step.tint"
              >
                <AppIcon :name="step.icon" class="h-5 w-5" />
              </span>
              <div>
                <p class="text-sm font-semibold text-text">
                  {{ i + 1 }}. {{ t(`invite.${step.key}Title`) }}
                </p>
                <p class="mt-1 text-sm text-text-muted">{{ t(`invite.${step.key}Desc`) }}</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
