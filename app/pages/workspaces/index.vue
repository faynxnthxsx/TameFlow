<script setup lang="ts">
const { t, locale } = useI18n()
const store = useWorkspacesStore()

const newName = ref('')
const creating = ref(false)
const errorMsg = ref('')
const showForm = ref(false)
const nameInput = ref<HTMLInputElement | null>(null)

function openForm() {
  showForm.value = true
  nextTick(() => nameInput.value?.focus())
}

function cancelForm() {
  showForm.value = false
  newName.value = ''
  errorMsg.value = ''
}

const { pending } = await useAsyncData('workspaces', async () => {
  await store.fetchWorkspaces()
  return true
}, { lazy: true })

async function create() {
  const name = newName.value.trim()
  if (!name) return
  creating.value = true
  errorMsg.value = ''
  try {
    const id = await store.createWorkspace(name)
    newName.value = ''
    await navigateTo(`/workspaces/${id}`)
  } catch {
    errorMsg.value = t('error.generic')
  } finally {
    creating.value = false
  }
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value)
}

const ROLE_BADGE_CLASSES: Record<string, string> = {
  owner: 'bg-primary/10 text-primary',
  admin: 'bg-info/10 text-info',
  member: 'bg-surface-alt text-text',
  viewer: 'bg-surface-alt text-text-muted'
}

// A soft, stable accent tint per card, keyed off the workspace name.
const TILE_TINTS = [
  'bg-primary/10 text-primary',
  'bg-success/10 text-success',
  'bg-warning/10 text-warning',
  'bg-brand-accent/10 text-brand-accent',
  'bg-info/10 text-info'
]
function tileTint(id: string) {
  let h = 0
  for (const c of id) h = (h + c.charCodeAt(0)) % TILE_TINTS.length
  return TILE_TINTS[h]
}
function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || 'WS'
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <div class="flex items-center justify-between">
      <div>
        <h1 class="text-2xl font-bold text-text">{{ t('workspace.listTitle') }}</h1>
        <p class="mt-1 text-sm text-text-muted">{{ t('workspace.members') }}</p>
      </div>
      <button
        v-if="!showForm"
        type="button"
        class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover"
        @click="openForm"
      >
        <AppIcon name="plus" class="h-4 w-4" />
        {{ t('workspace.create') }}
      </button>
    </div>

    <form
      v-if="showForm"
      class="mt-6 flex gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card"
      @submit.prevent="create"
    >
      <input
        ref="nameInput"
        v-model="newName"
        type="text"
        maxlength="80"
        :placeholder="t('workspace.namePlaceholder')"
        class="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      />
      <button
        type="submit"
        :disabled="creating || !newName.trim()"
        class="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-60"
      >
        {{ creating ? t('common.loading') : t('workspace.create') }}
      </button>
      <button
        type="button"
        class="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted hover:text-text"
        @click="cancelForm"
      >
        {{ t('common.cancel') }}
      </button>
    </form>
    <p v-if="errorMsg" class="mt-2 text-sm text-danger">{{ errorMsg }}</p>

    <p v-if="pending && !store.loaded" class="mt-8 text-text-muted">{{ t('common.loading') }}</p>

    <p
      v-else-if="store.workspaces.length === 0"
      class="mt-8 rounded-2xl border border-dashed border-border p-10 text-center text-text-muted"
    >
      {{ t('workspace.empty') }}
    </p>

    <div v-else class="mt-6 flex flex-col gap-3">
      <NuxtLink
        v-for="ws in store.workspaces"
        :key="ws.id"
        :to="`/workspaces/${ws.id}`"
        class="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card transition hover:border-primary hover:shadow-md"
      >
        <span
          class="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-sm font-bold"
          :class="tileTint(ws.id)"
        >
          {{ initials(ws.name) }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold text-text">{{ ws.name }}</p>
          <p class="mt-0.5 text-sm text-text-muted">
            {{ t('workspace.createdAt') }} {{ formatDate(ws.createdAt) }}
          </p>
        </div>
        <span
          class="rounded-full px-3 py-1 text-xs font-medium"
          :class="ROLE_BADGE_CLASSES[ws.role]"
        >
          {{ t(`role.${ws.role}`) }}
        </span>
      </NuxtLink>
    </div>
  </div>
</template>
