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
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <h1 class="text-2xl font-bold text-text">{{ t('invite.myTitle') }}</h1>

    <p v-if="pending" class="mt-8 text-text-muted">{{ t('common.loading') }}</p>

    <p
      v-else-if="!data || data.length === 0"
      class="mt-8 rounded-2xl border border-dashed border-border p-10 text-center text-text-muted"
    >
      {{ t('invite.noneForMe') }}
    </p>

    <template v-else>
      <p v-if="errorMsg" class="mt-4 text-sm text-danger">{{ errorMsg }}</p>
      <ul class="mt-6 flex flex-col gap-3">
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
  </div>
</template>
