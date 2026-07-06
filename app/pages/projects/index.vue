<script setup lang="ts">
const { t, locale } = useI18n()
const supabase = useSupabaseClient()

type ProjStatus = 'active' | 'not_started' | 'done'

const { data, pending } = await useAsyncData(
  'all-projects',
  async () => {
    const [projectsRes, tasksRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, description, created_at, updated_at, workspace:workspaces (id, name)')
        .order('created_at', { ascending: false }),
      supabase.from('tasks').select('project_id, status')
    ])
    const projects = projectsRes.data ?? []

    // One bulk read for member avatars across every workspace in view (RLS
    // already scopes it), grouped by workspace so each project can show its team.
    const wsIds = [...new Set(projects.map((p) => p.workspace?.id).filter(Boolean) as string[])]
    const membersRes = wsIds.length
      ? await supabase
          .from('workspace_members')
          .select('workspace_id, profile:user_profiles (display_name, avatar_url)')
          .in('workspace_id', wsIds)
      : { data: [] }
    const avatarsByWs = new Map<string, { name: string; avatar: string | null }[]>()
    for (const m of membersRes.data ?? []) {
      const arr = avatarsByWs.get(m.workspace_id) ?? []
      arr.push({ name: m.profile?.display_name ?? '?', avatar: m.profile?.avatar_url ?? null })
      avatarsByWs.set(m.workspace_id, arr)
    }

    const counts = new Map<string, { total: number; done: number }>()
    for (const tk of tasksRes.data ?? []) {
      const c = counts.get(tk.project_id) ?? { total: 0, done: 0 }
      c.total++
      if (tk.status === 'done') c.done++
      counts.set(tk.project_id, c)
    }

    return {
      projects: projects.map((p) => {
        const c = counts.get(p.id) ?? { total: 0, done: 0 }
        const pct = c.total ? Math.round((c.done / c.total) * 100) : 0
        // Derived lifecycle: done = every task complete, not_started = nothing
        // done yet (incl. no tasks), active = some but not all done.
        const status: ProjStatus =
          c.total > 0 && c.done === c.total ? 'done' : c.done === 0 ? 'not_started' : 'active'
        return {
          ...p,
          total: c.total,
          done: c.done,
          pct,
          status,
          avatars: avatarsByWs.get(p.workspace?.id ?? '') ?? []
        }
      })
    }
  },
  { lazy: true }
)

// --- filter / sort / paginate state ---
const search = ref('')
const tab = ref<'all' | ProjStatus>('all')
const sort = ref('recent')
const view = ref<'list' | 'grid'>('list')
const page = ref(1)
const PAGE_SIZE = 10

const all = computed(() => data.value?.projects ?? [])

const stats = computed(() => ({
  total: all.value.length,
  active: all.value.filter((p) => p.status === 'active').length,
  done: all.value.filter((p) => p.status === 'done').length,
  notStarted: all.value.filter((p) => p.status === 'not_started').length
}))

const statCards = computed(() => [
  { label: t('project.statTotal'), value: stats.value.total, icon: 'projects', tint: 'bg-primary/10 text-primary' },
  { label: t('project.statActive'), value: stats.value.active, icon: 'activity', tint: 'bg-info/10 text-info' },
  { label: t('project.statDone'), value: stats.value.done, icon: 'check', tint: 'bg-success/10 text-success' },
  { label: t('project.statNotStarted'), value: stats.value.notStarted, icon: 'clock', tint: 'bg-warning/10 text-warning' }
])

const tabs = computed(() => [
  { key: 'all' as const, label: t('project.tabAll'), count: stats.value.total },
  { key: 'active' as const, label: t('project.tabActive'), count: stats.value.active },
  { key: 'not_started' as const, label: t('project.tabNotStarted'), count: stats.value.notStarted },
  { key: 'done' as const, label: t('project.tabDone'), count: stats.value.done }
])

const sortOptions = computed(() => [
  { value: 'recent', label: t('project.sortRecent') },
  { value: 'progress', label: t('project.sortProgress') },
  { value: 'name', label: t('project.sortName') }
])

const filtered = computed(() => {
  let list = all.value
  if (tab.value !== 'all') list = list.filter((p) => p.status === tab.value)
  const q = search.value.trim().toLowerCase()
  if (q) {
    list = list.filter(
      (p) =>
        p.name.toLowerCase().includes(q) ||
        (p.description ?? '').toLowerCase().includes(q) ||
        (p.workspace?.name ?? '').toLowerCase().includes(q)
    )
  }
  const sorted = [...list]
  if (sort.value === 'progress') sorted.sort((a, b) => b.pct - a.pct)
  else if (sort.value === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name))
  else sorted.sort((a, b) => +new Date(b.created_at) - +new Date(a.created_at))
  return sorted
})

const pageCount = computed(() => Math.max(1, Math.ceil(filtered.value.length / PAGE_SIZE)))
const paged = computed(() => filtered.value.slice((page.value - 1) * PAGE_SIZE, page.value * PAGE_SIZE))
const rangeFrom = computed(() => (filtered.value.length === 0 ? 0 : (page.value - 1) * PAGE_SIZE + 1))
const rangeTo = computed(() => Math.min(page.value * PAGE_SIZE, filtered.value.length))

watch([tab, search, sort], () => (page.value = 1))
watch(pageCount, (n) => {
  if (page.value > n) page.value = n
})

// --- display helpers ---
const STATUS_BADGE: Record<ProjStatus, string> = {
  active: 'bg-info/10 text-info',
  not_started: 'bg-surface-alt text-text-muted',
  done: 'bg-success/10 text-success'
}
function statusLabel(s: ProjStatus) {
  return s === 'active'
    ? t('project.tabActive')
    : s === 'done'
      ? t('project.tabDone')
      : t('project.tabNotStarted')
}

// Per-project accent (tile + progress bar), stable by id — mirrors the varied
// hues in the design without hardcoding colors (all are theme tokens).
const PALETTE = [
  { tile: 'bg-primary', bar: 'bg-primary' },
  { tile: 'bg-success', bar: 'bg-success' },
  { tile: 'bg-brand-accent', bar: 'bg-brand-accent' },
  { tile: 'bg-warning', bar: 'bg-warning' },
  { tile: 'bg-info', bar: 'bg-info' },
  { tile: 'bg-danger', bar: 'bg-danger' }
]
function hash(id: string) {
  let h = 0
  for (const c of id) h = (h + c.charCodeAt(0)) % 997
  return h
}
function palette(id: string) {
  return PALETTE[hash(id) % PALETTE.length]
}
function letter(name: string) {
  return (name.trim()[0] ?? 'P').toUpperCase()
}
function initials(name: string) {
  return (name.trim()[0] ?? '?').toUpperCase()
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}
</script>

<template>
  <div class="mx-auto max-w-7xl">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-text">{{ t('nav.projects') }}</h1>
        <p class="mt-1 text-sm text-text-muted">{{ t('project.listSubtitle') }}</p>
      </div>
      <div class="relative w-full sm:w-72">
        <AppIcon name="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
        <input
          v-model="search"
          type="text"
          :placeholder="t('project.searchPlaceholder')"
          class="w-full rounded-xl border border-border bg-surface py-2.5 pl-9 pr-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
    </div>

    <p v-if="pending && !data" class="mt-8 text-text-muted">{{ t('common.loading') }}</p>

    <template v-else>
      <!-- Stat cards -->
      <div class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div
          v-for="card in statCards"
          :key="card.label"
          class="rounded-2xl border border-border bg-surface p-4 shadow-card"
        >
          <div class="flex items-center justify-between">
            <span class="grid h-10 w-10 place-items-center rounded-xl" :class="card.tint">
              <AppIcon :name="card.icon" class="h-5 w-5" />
            </span>
          </div>
          <p class="mt-3 text-2xl font-bold text-text">{{ card.value }}</p>
          <p class="text-sm text-text-muted">{{ card.label }}</p>
        </div>
      </div>

      <!-- Tabs + controls -->
      <div class="mt-6 flex flex-wrap items-center justify-between gap-3">
        <div class="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
          <button
            v-for="tb in tabs"
            :key="tb.key"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-sm font-medium transition"
            :class="tab === tb.key ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text'"
            @click="tab = tb.key"
          >
            {{ tb.label }}
            <span
              class="rounded-full px-1.5 text-xs"
              :class="tab === tb.key ? 'bg-primary/15 text-primary' : 'bg-surface-alt text-text-muted'"
            >
              {{ tb.count }}
            </span>
          </button>
        </div>

        <div class="flex items-center gap-2">
          <div class="w-40">
            <AppSelect v-model="sort" :options="sortOptions" icon="reports" />
          </div>
          <div class="flex rounded-xl border border-border bg-surface p-1">
            <button
              type="button"
              :title="t('workspace.listView')"
              class="grid h-8 w-8 place-items-center rounded-lg transition"
              :class="view === 'list' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text'"
              @click="view = 'list'"
            >
              <AppIcon name="menu" class="h-4 w-4" />
            </button>
            <button
              type="button"
              :title="t('workspace.gridView')"
              class="grid h-8 w-8 place-items-center rounded-lg transition"
              :class="view === 'grid' ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text'"
              @click="view = 'grid'"
            >
              <AppIcon name="dashboard" class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Empty -->
      <p
        v-if="filtered.length === 0"
        class="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-text-muted"
      >
        {{ all.length === 0 ? t('project.empty') : t('project.emptyFiltered') }}
      </p>

      <!-- List view -->
      <div v-else-if="view === 'list'" class="mt-5 flex flex-col gap-3">
        <NuxtLink
          v-for="p in paged"
          :key="p.id"
          :to="`/projects/${p.id}`"
          class="group flex items-center gap-4 rounded-2xl border border-border bg-surface px-4 py-3.5 shadow-card transition hover:border-primary hover:shadow-md"
        >
          <span
            class="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-base font-bold text-primary-fg"
            :class="palette(p.id).tile"
          >
            {{ letter(p.name) }}
          </span>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-2">
              <p class="truncate font-semibold text-text">{{ p.name }}</p>
              <span
                class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
                :class="STATUS_BADGE[p.status]"
              >
                {{ statusLabel(p.status) }}
              </span>
            </div>
            <p class="truncate text-sm text-text-muted">
              {{ p.description || p.workspace?.name }}
            </p>
          </div>

          <!-- Progress -->
          <div class="hidden w-40 shrink-0 md:block">
            <div class="flex items-center justify-between text-xs text-text-muted">
              <span>{{ t('workspace.progress') }}</span>
              <span class="font-medium text-text">{{ p.pct }}%</span>
            </div>
            <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-alt">
              <div class="h-full rounded-full" :class="palette(p.id).bar" :style="`width:${p.pct}%`" />
            </div>
          </div>

          <!-- Avatars -->
          <div v-if="p.avatars.length" class="hidden shrink-0 lg:flex">
            <div class="flex -space-x-2">
              <template v-for="(m, i) in p.avatars.slice(0, 3)" :key="i">
                <img
                  v-if="m.avatar"
                  :src="m.avatar"
                  :alt="m.name"
                  class="h-7 w-7 rounded-full object-cover ring-2 ring-surface"
                />
                <span
                  v-else
                  class="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-xs font-semibold text-primary ring-2 ring-surface"
                >
                  {{ initials(m.name) }}
                </span>
              </template>
            </div>
            <span v-if="p.avatars.length > 3" class="ml-1.5 self-center text-xs text-text-muted">
              +{{ p.avatars.length - 3 }}
            </span>
          </div>

          <!-- Updated -->
          <div class="hidden shrink-0 text-right xl:block">
            <p class="text-xs text-text-muted">{{ t('workspace.updatedAt') }}</p>
            <p class="text-xs font-medium text-text">{{ formatDate(p.updated_at ?? p.created_at) }}</p>
          </div>

          <AppIcon
            name="chevron-right"
            class="h-5 w-5 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary"
          />
        </NuxtLink>
      </div>

      <!-- Grid view -->
      <div v-else class="mt-5 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <NuxtLink
          v-for="p in paged"
          :key="p.id"
          :to="`/projects/${p.id}`"
          class="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-card transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
        >
          <div class="flex items-center gap-3">
            <span
              class="grid h-11 w-11 shrink-0 place-items-center rounded-xl text-base font-bold text-primary-fg"
              :class="palette(p.id).tile"
            >
              {{ letter(p.name) }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate font-semibold text-text">{{ p.name }}</p>
              <p class="truncate text-xs text-text-muted">{{ p.workspace?.name }}</p>
            </div>
            <span
              class="shrink-0 rounded-full px-2 py-0.5 text-xs font-medium"
              :class="STATUS_BADGE[p.status]"
            >
              {{ statusLabel(p.status) }}
            </span>
          </div>

          <p v-if="p.description" class="mt-3 line-clamp-2 text-sm text-text-muted">
            {{ p.description }}
          </p>

          <div class="mt-auto pt-4">
            <div class="flex items-center justify-between text-xs text-text-muted">
              <span>{{ p.done }}/{{ p.total }} {{ t('workspace.tasks') }}</span>
              <span class="font-medium text-text">{{ p.pct }}%</span>
            </div>
            <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-alt">
              <div class="h-full rounded-full" :class="palette(p.id).bar" :style="`width:${p.pct}%`" />
            </div>
          </div>
        </NuxtLink>
      </div>

      <!-- Pagination (only when it spans more than one page) -->
      <div
        v-if="pageCount > 1"
        class="mt-6 flex flex-wrap items-center justify-between gap-3"
      >
        <p class="text-sm text-text-muted">
          {{ t('project.showing', { from: rangeFrom, to: rangeTo, total: filtered.length }) }}
        </p>
        <div class="flex items-center gap-3">
          <div class="flex items-center gap-1">
            <button
              type="button"
              :disabled="page === 1"
              class="grid h-9 w-9 place-items-center rounded-lg border border-border text-text-muted transition hover:text-text disabled:opacity-40"
              @click="page--"
            >
              <AppIcon name="chevron-left" class="h-4 w-4" />
            </button>
            <button
              v-for="n in pageCount"
              :key="n"
              type="button"
              class="grid h-9 min-w-9 place-items-center rounded-lg border px-2 text-sm font-medium transition"
              :class="n === page
                ? 'border-primary bg-primary text-primary-fg'
                : 'border-border text-text-muted hover:text-text'"
              @click="page = n"
            >
              {{ n }}
            </button>
            <button
              type="button"
              :disabled="page === pageCount"
              class="grid h-9 w-9 place-items-center rounded-lg border border-border text-text-muted transition hover:text-text disabled:opacity-40"
              @click="page++"
            >
              <AppIcon name="chevron-right" class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>
    </template>
  </div>
</template>
