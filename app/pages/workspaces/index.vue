<script setup lang="ts">
const { t, locale } = useI18n()
const store = useWorkspacesStore()

const newName = ref('')
const creating = ref(false)
const errorMsg = ref('')
const showForm = ref(false)
const nameInput = ref<HTMLInputElement | null>(null)
const view = ref<'grid' | 'list'>('grid')

function openForm() {
  showForm.value = true
  errorMsg.value = ''
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
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(locale.value, {
    dateStyle: 'medium',
    timeStyle: 'short'
  })
}

const ROLE_BADGE_CLASSES: Record<string, string> = {
  owner: 'bg-primary/10 text-primary',
  admin: 'bg-info/10 text-info',
  member: 'bg-surface-alt text-text',
  viewer: 'bg-surface-alt text-text-muted'
}

// A cohesive cool-tone gradient per card (blue / violet / cyan brand tokens
// only — no clashing warm colors), stable per workspace id. The logo tile
// reuses the same gradient so each card reads as one unit.
const COVER_GRADIENTS = [
  'from-primary to-info',
  'from-info to-primary',
  'from-primary to-info',
  'from-info to-primary'
]
function hash(id: string) {
  let h = 0
  for (const c of id) h = (h + c.charCodeAt(0)) % 997
  return h
}
function cover(id: string) {
  return COVER_GRADIENTS[hash(id) % COVER_GRADIENTS.length]
}
function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? parts[1][0] : (parts[0]?.[1] ?? '')
  return (first + second).toUpperCase() || 'WS'
}
</script>

<template>
  <div class="mx-auto max-w-7xl">
    <!-- Header + toolbar -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <div class="flex items-center gap-2.5">
          <h1 class="text-2xl font-bold text-text">{{ t('workspace.listTitle') }}</h1>
          <span
            v-if="store.loaded && store.workspaces.length"
            class="grid h-6 min-w-6 place-items-center rounded-full bg-primary/10 px-2 text-sm font-semibold text-primary"
          >
            {{ store.workspaces.length }}
          </span>
        </div>
        <p class="mt-1 text-sm text-text-muted">{{ t('workspace.subtitle') }}</p>
      </div>

      <div class="flex rounded-xl border border-border bg-surface p-1">
        <button
          type="button"
          :title="t('workspace.gridView')"
          class="grid h-8 w-8 place-items-center rounded-lg transition"
          :class="view === 'grid' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text'"
          @click="view = 'grid'"
        >
          <AppIcon name="dashboard" class="h-4 w-4" />
        </button>
        <button
          type="button"
          :title="t('workspace.listView')"
          class="grid h-8 w-8 place-items-center rounded-lg transition"
          :class="view === 'list' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text'"
          @click="view = 'list'"
        >
          <AppIcon name="menu" class="h-4 w-4" />
        </button>
      </div>
    </div>

    <p v-if="pending && !store.loaded" class="mt-8 text-text-muted">{{ t('common.loading') }}</p>

    <!-- Empty state -->
    <div
      v-else-if="store.workspaces.length === 0"
      class="mt-8 flex flex-col items-center gap-4 rounded-2xl border border-dashed border-border p-12 text-center"
    >
      <span class="grid h-14 w-14 place-items-center rounded-2xl bg-primary/10 text-primary">
        <AppIcon name="workspace" class="h-7 w-7" />
      </span>
      <p class="text-text-muted">{{ t('workspace.empty') }}</p>
      <button
        type="button"
        class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover"
        @click="openForm"
      >
        <AppIcon name="plus" class="h-4 w-4" />
        {{ t('workspace.create') }}
      </button>
    </div>

    <!-- Grid view -->
    <div v-else-if="view === 'grid'" class="mt-6 grid grid-cols-1 gap-5 sm:grid-cols-2 xl:grid-cols-3">
      <NuxtLink
        v-for="ws in store.workspaces"
        :key="ws.id"
        :to="`/workspaces/${ws.id}`"
        class="group flex flex-col overflow-hidden rounded-2xl border border-border bg-surface shadow-card transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
      >
        <!-- Cover -->
        <div class="h-16 bg-gradient-to-br" :class="cover(ws.id)" />

        <div class="flex flex-1 flex-col px-5 pb-5 pt-4">
          <!-- Logo tile (nudged up onto the cover as a floating badge) + name -->
          <div class="flex items-center gap-3">
            <span
              class="grid h-14 w-14 shrink-0 -translate-y-8 place-items-center rounded-2xl bg-gradient-to-br text-lg font-bold text-primary-fg shadow-card ring-4 ring-surface"
              :class="cover(ws.id)"
            >
              {{ initials(ws.name) }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex items-center gap-2">
                <p class="truncate font-semibold text-text">{{ ws.name }}</p>
                <span
                  class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="ROLE_BADGE_CLASSES[ws.role]"
                >
                  {{ t(`role.${ws.role}`) }}
                </span>
              </div>
              <p class="mt-0.5 text-xs text-text-muted">
                {{ t('workspace.createdAt') }} {{ formatDate(ws.createdAt) }}
              </p>
            </div>
          </div>

          <!-- Member avatar stack -->
          <div class="mt-4 flex items-center">
            <div class="flex -space-x-2">
              <template v-for="m in ws.memberAvatars.slice(0, 4)" :key="m.id">
                <img
                  v-if="m.avatar"
                  :src="m.avatar"
                  :alt="m.name"
                  class="h-8 w-8 rounded-full object-cover ring-2 ring-surface"
                />
                <span
                  v-else
                  class="grid h-8 w-8 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary ring-2 ring-surface"
                >
                  {{ initials(m.name) }}
                </span>
              </template>
            </div>
            <span
              v-if="ws.memberCount > 4"
              class="ml-2 text-xs font-medium text-text-muted"
            >
              +{{ ws.memberCount - 4 }}
            </span>
          </div>

          <!-- Stats -->
          <div class="mt-auto grid grid-cols-4 gap-2 border-t border-border pt-4">
            <div class="flex flex-col gap-0.5">
              <span class="flex items-center gap-1 text-sm font-semibold text-text">
                <AppIcon name="members" class="h-3.5 w-3.5 text-text-muted" />{{ ws.memberCount }}
              </span>
              <span class="text-xs text-text-muted">{{ t('workspace.members') }}</span>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="flex items-center gap-1 text-sm font-semibold text-text">
                <AppIcon name="projects" class="h-3.5 w-3.5 text-text-muted" />{{ ws.projectCount }}
              </span>
              <span class="text-xs text-text-muted">{{ t('workspace.projects') }}</span>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="flex items-center gap-1 text-sm font-semibold text-text">
                <AppIcon name="tasks" class="h-3.5 w-3.5 text-text-muted" />{{ ws.taskCount }}
              </span>
              <span class="text-xs text-text-muted">{{ t('workspace.tasks') }}</span>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="flex items-center gap-1 text-sm font-semibold text-text">
                <span
                  class="h-3.5 w-3.5 rounded-full"
                  :style="{ background: `conic-gradient(var(--tf-color-primary) ${ws.progress}%, var(--tf-color-border) 0)` }"
                />{{ ws.progress }}%
              </span>
              <span class="text-xs text-text-muted">{{ t('workspace.progress') }}</span>
            </div>
          </div>

          <p class="mt-4 border-t border-border pt-3 text-xs text-text-muted">
            {{ t('workspace.updatedAt') }} {{ formatDateTime(ws.updatedAt) }}
          </p>
        </div>
      </NuxtLink>

      <!-- Create card -->
      <button
        type="button"
        class="flex min-h-[16rem] flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed border-border p-5 text-center transition hover:border-primary hover:bg-primary/5"
        @click="openForm"
      >
        <span class="grid h-12 w-12 place-items-center rounded-full bg-primary/10 text-primary">
          <AppIcon name="plus" class="h-6 w-6" />
        </span>
        <span class="font-semibold text-primary">{{ t('workspace.create') }}</span>
        <span class="text-sm text-text-muted">{{ t('workspace.createSubtitle') }}</span>
      </button>
    </div>

    <!-- List view -->
    <div v-else class="mt-6 flex flex-col gap-3">
      <NuxtLink
        v-for="ws in store.workspaces"
        :key="ws.id"
        :to="`/workspaces/${ws.id}`"
        class="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card transition hover:border-primary hover:shadow-md"
      >
        <span
          class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-gradient-to-br text-sm font-bold text-primary-fg"
          :class="cover(ws.id)"
        >
          {{ initials(ws.name) }}
        </span>
        <div class="min-w-0 flex-1">
          <p class="truncate font-semibold text-text">{{ ws.name }}</p>
          <p class="mt-0.5 text-sm text-text-muted">
            {{ ws.memberCount }} {{ t('workspace.members') }} · {{ ws.projectCount }} {{ t('workspace.projects') }} · {{ ws.progress }}% {{ t('workspace.progress') }}
          </p>
        </div>
        <span
          class="rounded-full px-3 py-1 text-xs font-medium"
          :class="ROLE_BADGE_CLASSES[ws.role]"
        >
          {{ t(`role.${ws.role}`) }}
        </span>
      </NuxtLink>

      <!-- Create row -->
      <button
        type="button"
        class="flex items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-border p-4 text-sm font-medium text-primary transition hover:border-primary hover:bg-primary/5"
        @click="openForm"
      >
        <AppIcon name="plus" class="h-4 w-4" />
        {{ t('workspace.create') }}
      </button>
    </div>

    <!-- Create modal -->
    <Teleport to="body">
      <div
        v-if="showForm"
        class="fixed inset-0 z-50 flex items-center justify-center p-4"
      >
        <div class="absolute inset-0 bg-text/50 backdrop-blur-sm" @click="cancelForm" />
        <div class="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-modal">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <span class="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-primary-hover text-primary-fg">
                <AppIcon name="workspace" class="h-5 w-5" />
              </span>
              <div>
                <h2 class="text-lg font-bold text-text">{{ t('workspace.create') }}</h2>
                <p class="text-sm text-text-muted">{{ t('workspace.createSubtitle') }}</p>
              </div>
            </div>
            <button
              type="button"
              class="rounded-lg p-1 text-text-muted transition hover:bg-surface-alt hover:text-text"
              @click="cancelForm"
            >
              <AppIcon name="x" class="h-5 w-5" />
            </button>
          </div>

          <form class="mt-5" @submit.prevent="create">
            <label class="mb-1.5 block text-sm font-medium text-text">
              {{ t('workspace.namePlaceholder') }}
            </label>
            <input
              ref="nameInput"
              v-model="newName"
              type="text"
              maxlength="80"
              :placeholder="t('workspace.namePlaceholder')"
              class="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              @keyup.esc="cancelForm"
            />
            <p v-if="errorMsg" class="mt-2 text-sm text-danger">{{ errorMsg }}</p>

            <div class="mt-5 flex justify-end gap-3">
              <button
                type="button"
                class="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-muted transition hover:text-text"
                @click="cancelForm"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="submit"
                :disabled="creating || !newName.trim()"
                class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover disabled:opacity-60"
              >
                <AppIcon name="plus" class="h-4 w-4" />
                {{ creating ? t('common.loading') : t('workspace.create') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
