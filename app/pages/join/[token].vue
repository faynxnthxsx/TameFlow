<script setup lang="ts">
// Public invite-link landing (Discord-style). Shows which workspace the link
// invites you to; sign in (if needed) and redeem to join.
definePageMeta({ layout: 'auth' })

const route = useRoute()
const { t } = useI18n()
const supabase = useSupabaseClient()

const token = route.params.token as string

const { data, pending } = await useAsyncData(
  `invite-link-${token}`,
  async () => {
    // getUser() is the reliable session source (the useSupabaseUser() ref can
    // read null even with a valid session); we key the CTA off it.
    const [infoRes, authRes] = await Promise.all([
      supabase.rpc('invite_link_info', { link_token: token }),
      supabase.auth.getUser()
    ])
    if (infoRes.error) throw infoRes.error
    return {
      link: infoRes.data?.[0] ?? null,
      userId: authRes.data.user?.id ?? null
    }
  },
  { lazy: true }
)

const isLoggedIn = computed(() => !!data.value?.userId)
const link = computed(() => data.value?.link ?? null)

const joining = ref(false)
const errorMsg = ref('')

function signInToJoin() {
  // Remembered by login.vue / confirm.vue so we come back here after auth.
  if (import.meta.client) localStorage.setItem('tf_post_login', route.fullPath)
  navigateTo('/login')
}

async function join() {
  joining.value = true
  errorMsg.value = ''
  const { data: wsId, error } = await supabase.rpc('redeem_invite_link', { link_token: token })
  joining.value = false
  if (error || !wsId) {
    errorMsg.value = t('error.generic')
    return
  }
  await navigateTo(`/workspaces/${wsId}`)
}

const ROLE_BADGE_CLASSES: Record<string, string> = {
  owner: 'bg-primary/10 text-primary',
  admin: 'bg-info/10 text-info',
  member: 'bg-surface-alt text-text',
  viewer: 'bg-surface-alt text-text-muted'
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? parts[1][0] : (parts[0]?.[1] ?? '')
  return (first + second).toUpperCase() || 'WS'
}
</script>

<template>
  <div class="w-full max-w-md rounded-2xl border border-border bg-surface p-8 text-center shadow-modal">
    <p v-if="pending" class="text-text-muted">{{ t('common.loading') }}</p>

    <!-- Invalid / revoked link -->
    <template v-else-if="!link">
      <span class="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-danger/10 text-danger">
        <AppIcon name="x" class="h-7 w-7" />
      </span>
      <h1 class="mt-4 text-xl font-bold text-text">{{ t('invite.joinInvalidTitle') }}</h1>
      <p class="mt-2 text-sm text-text-muted">{{ t('invite.joinInvalidSubtitle') }}</p>
      <NuxtLink to="/" class="mt-6 inline-block text-sm font-medium text-primary hover:underline">
        {{ t('common.back') }}
      </NuxtLink>
    </template>

    <!-- Valid invite -->
    <template v-else>
      <span class="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-primary text-xl font-bold text-primary-fg shadow-sm">
        {{ initials(link.workspace_name) }}
      </span>
      <p class="mt-4 text-sm text-text-muted">{{ t('invite.joinKicker') }}</p>
      <h1 class="mt-1 text-2xl font-bold text-text">{{ link.workspace_name }}</h1>
      <p class="mt-3 text-sm text-text-muted">
        {{ t('invite.invitedAs') }}
        <span class="ml-1 rounded-full px-2.5 py-0.5 text-xs font-medium" :class="ROLE_BADGE_CLASSES[link.role]">
          {{ t(`role.${link.role}`) }}
        </span>
      </p>

      <p v-if="errorMsg" class="mt-4 text-sm text-danger">{{ errorMsg }}</p>

      <!-- Already a member -->
      <NuxtLink
        v-if="isLoggedIn && link.already_member"
        :to="`/workspaces/${link.workspace_id}`"
        class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg shadow-sm transition hover:bg-primary-hover"
      >
        {{ t('invite.joinGoToWorkspace') }}
      </NuxtLink>

      <!-- Signed in, not a member yet -->
      <button
        v-else-if="isLoggedIn"
        type="button"
        :disabled="joining"
        class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg shadow-sm transition hover:bg-primary-hover disabled:opacity-60"
        @click="join"
      >
        <AppIcon name="user-plus" class="h-5 w-5" />
        {{ joining ? t('common.loading') : t('invite.joinAccept') }}
      </button>

      <!-- Signed out -->
      <template v-else>
        <button
          type="button"
          class="mt-6 flex w-full items-center justify-center gap-2 rounded-xl bg-primary px-5 py-3 text-sm font-semibold text-primary-fg shadow-sm transition hover:bg-primary-hover"
          @click="signInToJoin"
        >
          {{ t('invite.joinSignIn') }}
        </button>
        <p class="mt-3 text-xs text-text-muted">{{ t('invite.joinSignInHint') }}</p>
      </template>
    </template>
  </div>
</template>
