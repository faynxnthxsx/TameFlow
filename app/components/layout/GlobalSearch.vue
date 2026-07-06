<script setup lang="ts">
// Real quick-search over the caller's workspaces and projects (RLS-scoped),
// replacing the previously decorative navbar input. Client-side filter over a
// single up-front load — the dataset is small and already cached per session.
const { t } = useI18n()
const supabase = useSupabaseClient()

const query = ref('')
const open = ref(false)
const root = ref<HTMLElement | null>(null)
onClickOutside(root, () => (open.value = false))

const workspaces = ref<{ id: string; name: string }[]>([])
const projects = ref<{ id: string; name: string; workspace: { name: string } | null }[]>([])

async function load() {
  const [w, p] = await Promise.all([
    supabase.from('workspaces').select('id, name'),
    supabase.from('projects').select('id, name, workspace:workspaces (name)')
  ])
  workspaces.value = w.data ?? []
  projects.value = (p.data ?? []) as typeof projects.value
}
onMounted(load)

const q = computed(() => query.value.trim().toLowerCase())
const wsResults = computed(() =>
  q.value ? workspaces.value.filter((x) => x.name.toLowerCase().includes(q.value)).slice(0, 5) : []
)
const projResults = computed(() =>
  q.value
    ? projects.value
        .filter(
          (x) =>
            x.name.toLowerCase().includes(q.value) ||
            (x.workspace?.name ?? '').toLowerCase().includes(q.value)
        )
        .slice(0, 6)
    : []
)
const hasResults = computed(() => wsResults.value.length > 0 || projResults.value.length > 0)

function pick() {
  open.value = false
  query.value = ''
}
</script>

<template>
  <div ref="root" class="relative hidden max-w-sm flex-1 sm:block">
    <div class="relative flex items-center">
      <AppIcon name="search" class="pointer-events-none absolute left-3 h-4 w-4 text-text-muted" />
      <input
        v-model="query"
        type="text"
        :placeholder="`${t('common.search')}...`"
        class="w-full rounded-lg border border-border bg-surface-alt py-2 pl-9 pr-3 text-sm text-text placeholder:text-text-muted focus:border-primary focus:bg-surface focus:outline-none"
        @focus="open = true"
      />
    </div>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <div
        v-if="open"
        class="absolute left-0 right-0 z-20 mt-2 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-modal"
      >
        <!-- Hint (no query yet) -->
        <p v-if="!q" class="px-4 py-3 text-sm text-text-muted">{{ t('search.hint') }}</p>

        <!-- No matches -->
        <p v-else-if="!hasResults" class="px-4 py-3 text-sm text-text-muted">
          {{ t('search.noResults') }}
        </p>

        <template v-else>
          <template v-if="wsResults.length">
            <p class="px-4 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-text-muted">
              {{ t('search.workspaces') }}
            </p>
            <NuxtLink
              v-for="ws in wsResults"
              :key="ws.id"
              :to="`/workspaces/${ws.id}`"
              class="mx-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-surface-alt"
              @click="pick"
            >
              <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <AppIcon name="workspace" class="h-4 w-4" />
              </span>
              <span class="truncate text-text">{{ ws.name }}</span>
            </NuxtLink>
          </template>

          <template v-if="projResults.length">
            <p class="px-4 pb-1 pt-2 text-xs font-medium uppercase tracking-wide text-text-muted">
              {{ t('search.projects') }}
            </p>
            <NuxtLink
              v-for="p in projResults"
              :key="p.id"
              :to="`/projects/${p.id}`"
              class="mx-1 flex items-center gap-3 rounded-lg px-3 py-2 text-sm transition hover:bg-surface-alt"
              @click="pick"
            >
              <span class="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-success/10 text-success">
                <AppIcon name="projects" class="h-4 w-4" />
              </span>
              <span class="min-w-0 flex-1 truncate text-text">{{ p.name }}</span>
              <span class="shrink-0 truncate text-xs text-text-muted">{{ p.workspace?.name }}</span>
            </NuxtLink>
          </template>
        </template>
      </div>
    </Transition>
  </div>
</template>
