<script setup lang="ts">
const { t, locale } = useI18n()
const supabase = useSupabaseClient()

interface FeedItem {
  id: string
  kind: 'task' | 'project'
  at: string
  title: string
  team: string | null
  tag: string | null // project name (tasks only)
  actorName: string | null
  actorAvatar: string | null
  createdBy: string | null
  assigneeId: string | null
  complete: boolean // task marked done
  link: string
}

const { data, pending } = await useAsyncData(
  'activity-feed',
  async () => {
    const { data: auth } = await supabase.auth.getUser()
    const myId = auth.user?.id ?? null

    const [tasksRes, projectsRes] = await Promise.all([
      supabase
        .from('tasks')
        .select(
          'id, title, status, created_at, created_by, assignee_id, project:projects (name, workspace:workspaces (name)), creator:user_profiles!tasks_created_by_fkey (display_name, avatar_url)'
        )
        .order('created_at', { ascending: false })
        .limit(100),
      supabase
        .from('projects')
        .select(
          'id, name, created_at, created_by, workspace:workspaces (name), creator:user_profiles!projects_created_by_fkey (display_name, avatar_url)'
        )
        .order('created_at', { ascending: false })
        .limit(100)
    ])

    const items: FeedItem[] = [
      ...(tasksRes.data ?? []).map((tk): FeedItem => ({
        id: `t-${tk.id}`,
        kind: 'task',
        at: tk.created_at,
        title: tk.title,
        team: tk.project?.workspace?.name ?? null,
        tag: tk.project?.name ?? null,
        actorName: tk.creator?.display_name || null,
        actorAvatar: tk.creator?.avatar_url ?? null,
        createdBy: tk.created_by,
        assigneeId: tk.assignee_id,
        complete: tk.status === 'done',
        link: `/tasks/${tk.id}`
      })),
      ...(projectsRes.data ?? []).map((p): FeedItem => ({
        id: `p-${p.id}`,
        kind: 'project',
        at: p.created_at,
        title: p.name,
        team: p.workspace?.name ?? null,
        tag: null,
        actorName: p.creator?.display_name || null,
        actorAvatar: p.creator?.avatar_url ?? null,
        createdBy: p.created_by,
        assigneeId: null,
        complete: false,
        link: `/projects/${p.id}`
      }))
    ].sort((a, b) => b.at.localeCompare(a.at))

    return { myId, items }
  },
  { lazy: true }
)

const allItems = computed(() => data.value?.items ?? [])
const myId = computed(() => data.value?.myId ?? null)

// --- filter / sort / paginate state ---
type Tab = 'all' | 'assigned' | 'created' | 'completed'
type Quick = null | 'today' | 'week' | 'open' | 'done'
const tab = ref<Tab>('all')
const team = ref('all')
const sort = ref<'newest' | 'oldest'>('newest')
const view = ref<'list' | 'grid'>('list')
const quick = ref<Quick>(null)
const shown = ref(8)

const PAGE = 8

function isMine(i: FeedItem) {
  return i.createdBy === myId.value
}
function assignedToMe(i: FeedItem) {
  return i.kind === 'task' && i.assigneeId === myId.value
}
function inDays(iso: string, days: number) {
  const cutoff = Date.now() - days * 86_400_000
  return new Date(iso).getTime() >= cutoff
}
function isToday(iso: string) {
  const d = new Date(iso)
  const n = new Date()
  return d.getFullYear() === n.getFullYear() && d.getMonth() === n.getMonth() && d.getDate() === n.getDate()
}

// Tab labels double as the summary-tile labels.
const tabs = computed<{ key: Tab; label: string }[]>(() => [
  { key: 'all', label: t('activity.tabAll') },
  { key: 'assigned', label: t('activity.tabAssigned') },
  { key: 'created', label: t('activity.tabCreated') },
  { key: 'completed', label: t('activity.tabCompleted') }
])

const teamOptions = computed(() => {
  const names = [...new Set(allItems.value.map((i) => i.team).filter(Boolean) as string[])]
  return [
    { value: 'all', label: t('activity.allTeams') },
    ...names.map((n) => ({ value: n, label: n }))
  ]
})

const sortOptions = computed(() => [
  { value: 'newest', label: t('activity.sortNewest') },
  { value: 'oldest', label: t('activity.sortOldest') }
])

const summary = computed(() => ({
  total: allItems.value.length,
  assigned: allItems.value.filter(assignedToMe).length,
  created: allItems.value.filter(isMine).length,
  completed: allItems.value.filter((i) => i.complete).length
}))

const quickCounts = computed(() => ({
  today: allItems.value.filter((i) => isToday(i.at)).length,
  week: allItems.value.filter((i) => inDays(i.at, 7)).length,
  open: allItems.value.filter((i) => i.kind === 'task' && !i.complete).length,
  done: allItems.value.filter((i) => i.complete).length
}))

const quickFilters = computed<{ key: Exclude<Quick, null>; label: string; icon: string; count: number }[]>(() => [
  { key: 'today', label: t('activity.quickToday'), icon: 'calendar', count: quickCounts.value.today },
  { key: 'week', label: t('activity.quickWeek'), icon: 'calendar', count: quickCounts.value.week },
  { key: 'open', label: t('activity.quickOpen'), icon: 'clock', count: quickCounts.value.open },
  { key: 'done', label: t('activity.quickDone'), icon: 'check', count: quickCounts.value.done }
])

function toggleQuick(key: Exclude<Quick, null>) {
  quick.value = quick.value === key ? null : key
}

const filtered = computed(() => {
  let list = allItems.value
  if (tab.value === 'assigned') list = list.filter(assignedToMe)
  else if (tab.value === 'created') list = list.filter(isMine)
  else if (tab.value === 'completed') list = list.filter((i) => i.complete)

  if (team.value !== 'all') list = list.filter((i) => i.team === team.value)

  if (quick.value === 'today') list = list.filter((i) => isToday(i.at))
  else if (quick.value === 'week') list = list.filter((i) => inDays(i.at, 7))
  else if (quick.value === 'open') list = list.filter((i) => i.kind === 'task' && !i.complete)
  else if (quick.value === 'done') list = list.filter((i) => i.complete)

  const sorted = [...list].sort((a, b) =>
    sort.value === 'oldest' ? a.at.localeCompare(b.at) : b.at.localeCompare(a.at)
  )
  return sorted
})

const visible = computed(() => filtered.value.slice(0, shown.value))
const hasMore = computed(() => filtered.value.length > shown.value)

watch([tab, team, sort, quick], () => (shown.value = PAGE))

// --- date bucketing (Today / Yesterday / dated) ---
function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
function bucketLabel(iso: string) {
  const diffDays = Math.round((dayStart(new Date()) - dayStart(new Date(iso))) / 86_400_000)
  if (diffDays <= 0) return t('activity.today')
  if (diffDays === 1) return t('activity.yesterday')
  return new Date(iso).toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric' })
}
const groups = computed(() => {
  const out: { label: string; items: FeedItem[] }[] = []
  for (const item of visible.value) {
    const label = bucketLabel(item.at)
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push(item)
    else out.push({ label, items: [item] })
  }
  return out
})

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60]
]
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  for (const [unit, secs] of UNITS) {
    if (diff >= secs) return rtf.format(-Math.floor(diff / secs), unit)
  }
  return rtf.format(0, 'second')
}
function initials(name: string | null) {
  return (name ?? '?').trim().slice(0, 2).toUpperCase() || '??'
}
function isDone(i: FeedItem) {
  return i.kind === 'project' || i.complete
}
</script>

<template>
  <div class="mx-auto max-w-7xl">
    <!-- Header -->
    <h1 class="text-2xl font-bold text-text">{{ t('nav.activity') }}</h1>
    <p class="mt-1 text-sm text-text-muted">{{ t('activity.subtitle') }}</p>

    <div class="mt-6 flex flex-col gap-6 lg:flex-row">
      <!-- Main column -->
      <div class="min-w-0 flex-1">
        <!-- Tabs + controls -->
        <div class="flex flex-wrap items-center justify-between gap-3">
          <div class="flex flex-wrap gap-1 rounded-xl border border-border bg-surface p-1">
            <button
              v-for="tb in tabs"
              :key="tb.key"
              type="button"
              class="rounded-lg px-3 py-1.5 text-sm font-medium transition"
              :class="tab === tb.key ? 'bg-primary/10 text-primary' : 'text-text-muted hover:text-text'"
              @click="tab = tb.key"
            >
              {{ tb.label }}
            </button>
          </div>

          <div class="flex items-center gap-2">
            <div class="w-36"><AppSelect v-model="team" :options="teamOptions" icon="workspace" /></div>
            <div class="w-40"><AppSelect v-model="sort" :options="sortOptions" icon="reports" /></div>
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

        <!-- Loading / empty -->
        <p v-if="pending" class="mt-8 text-text-muted">{{ t('common.loading') }}</p>
        <p
          v-else-if="filtered.length === 0"
          class="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-12 text-center text-text-muted"
        >
          <AppIcon name="activity" class="h-8 w-8 text-text-muted/50" />
          {{ allItems.length === 0 ? t('activity.empty') : t('activity.emptyFiltered') }}
        </p>

        <!-- Feed -->
        <div v-else class="mt-5 space-y-6">
          <section v-for="group in groups" :key="group.label">
            <h2 class="mb-3 px-1 text-sm font-semibold text-text-muted">{{ group.label }}</h2>

            <!-- List view -->
            <ul v-if="view === 'list'" class="space-y-3">
              <li v-for="item in group.items" :key="item.id" class="flex items-stretch gap-3">
                <!-- timeline dot -->
                <div class="relative flex w-2 shrink-0 justify-center">
                  <span
                    class="mt-5 h-2.5 w-2.5 rounded-full"
                    :class="isDone(item) ? 'bg-success' : 'bg-warning'"
                  />
                </div>

                <div
                  class="flex flex-1 items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card transition hover:border-primary/50"
                >
                  <NuxtLink :to="item.link" class="min-w-0 flex-1">
                    <p class="truncate text-sm">
                      <span class="text-text-muted">
                        {{ t(item.kind === 'task' ? 'activity.createdTask' : 'activity.createdProject') }}
                      </span>
                      <span class="font-semibold text-text">{{ item.title }}</span>
                    </p>
                    <div class="mt-1 flex flex-wrap items-center gap-2 text-xs text-text-muted">
                      <span v-if="item.team" class="truncate">{{ item.team }}</span>
                      <span
                        v-if="item.tag"
                        class="inline-flex items-center gap-1 rounded-md bg-surface-alt px-1.5 py-0.5 text-text"
                      >
                        <AppIcon name="projects" class="h-3 w-3" />{{ item.tag }}
                      </span>
                    </div>
                  </NuxtLink>

                  <!-- actor + time -->
                  <div class="hidden shrink-0 items-center gap-2 sm:flex">
                    <img
                      v-if="item.actorAvatar"
                      :src="item.actorAvatar"
                      :alt="item.actorName ?? ''"
                      class="h-7 w-7 rounded-full object-cover"
                    />
                    <span
                      v-else
                      class="grid h-7 w-7 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary"
                    >
                      {{ initials(item.actorName) }}
                    </span>
                    <div class="text-right">
                      <p class="max-w-[9rem] truncate text-xs font-medium text-text">{{ item.actorName ?? '—' }}</p>
                      <p class="text-[11px] text-text-muted">{{ timeAgo(item.at) }}</p>
                    </div>
                  </div>

                </div>
              </li>
            </ul>

            <!-- Grid view -->
            <div v-else class="grid gap-3 sm:grid-cols-2">
              <NuxtLink
                v-for="item in group.items"
                :key="item.id"
                :to="item.link"
                class="flex flex-col gap-2 rounded-2xl border border-border bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-primary/50"
              >
                <p class="truncate text-sm font-semibold text-text">{{ item.title }}</p>
                <div class="flex flex-wrap items-center gap-2 text-xs text-text-muted">
                  <span v-if="item.team" class="truncate">{{ item.team }}</span>
                  <span v-if="item.tag" class="inline-flex items-center gap-1 rounded-md bg-surface-alt px-1.5 py-0.5 text-text">
                    <AppIcon name="projects" class="h-3 w-3" />{{ item.tag }}
                  </span>
                </div>
                <div class="mt-auto flex items-center justify-between pt-1 text-xs text-text-muted">
                  <span class="truncate">{{ item.actorName ?? '—' }}</span>
                  <span class="shrink-0">{{ timeAgo(item.at) }}</span>
                </div>
              </NuxtLink>
            </div>
          </section>

          <!-- Load more -->
          <div v-if="hasMore" class="pt-2 text-center">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-5 py-2.5 text-sm font-medium text-primary shadow-card transition hover:bg-surface-alt"
              @click="shown += PAGE"
            >
              {{ t('activity.loadMore') }}
              <AppIcon name="chevron-down" class="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      <!-- Right column (no calendar, per request) -->
      <aside class="w-full shrink-0 space-y-4 lg:w-80">
        <!-- Activity summary -->
        <div class="rounded-2xl border border-border bg-surface p-4 shadow-card">
          <p class="mb-3 text-sm font-semibold text-text">{{ t('activity.summaryTitle') }}</p>
          <div class="grid grid-cols-2 gap-3">
            <div class="rounded-xl border border-border p-3">
              <span class="grid h-8 w-8 place-items-center rounded-lg bg-primary/10 text-primary">
                <AppIcon name="members" class="h-4 w-4" />
              </span>
              <p class="mt-2 text-xl font-bold text-text">{{ summary.total }}</p>
              <p class="text-xs text-text-muted">{{ t('activity.tabAll') }}</p>
            </div>
            <div class="rounded-xl border border-border p-3">
              <span class="grid h-8 w-8 place-items-center rounded-lg bg-brand-accent/10 text-brand-accent">
                <AppIcon name="user" class="h-4 w-4" />
              </span>
              <p class="mt-2 text-xl font-bold text-text">{{ summary.assigned }}</p>
              <p class="text-xs text-text-muted">{{ t('activity.tabAssigned') }}</p>
            </div>
            <div class="rounded-xl border border-border p-3">
              <span class="grid h-8 w-8 place-items-center rounded-lg bg-warning/10 text-warning">
                <AppIcon name="projects" class="h-4 w-4" />
              </span>
              <p class="mt-2 text-xl font-bold text-text">{{ summary.created }}</p>
              <p class="text-xs text-text-muted">{{ t('activity.tabCreated') }}</p>
            </div>
            <div class="rounded-xl border border-border p-3">
              <span class="grid h-8 w-8 place-items-center rounded-lg bg-success/10 text-success">
                <AppIcon name="check" class="h-4 w-4" />
              </span>
              <p class="mt-2 text-xl font-bold text-text">{{ summary.completed }}</p>
              <p class="text-xs text-text-muted">{{ t('activity.tabCompleted') }}</p>
            </div>
          </div>
        </div>

        <!-- Quick filters -->
        <div class="rounded-2xl border border-border bg-surface p-4 shadow-card">
          <p class="mb-2 text-sm font-semibold text-text">{{ t('activity.quickTitle') }}</p>
          <ul class="space-y-1">
            <li v-for="q in quickFilters" :key="q.key">
              <button
                type="button"
                class="flex w-full items-center gap-2.5 rounded-xl px-3 py-2 text-sm transition"
                :class="quick === q.key ? 'bg-primary/10 text-primary' : 'text-text hover:bg-surface-alt'"
                @click="toggleQuick(q.key)"
              >
                <AppIcon :name="q.icon" class="h-4 w-4 shrink-0" :class="quick === q.key ? 'text-primary' : 'text-text-muted'" />
                <span class="flex-1 text-left">{{ q.label }}</span>
                <span
                  class="rounded-full px-2 py-0.5 text-xs font-medium"
                  :class="quick === q.key ? 'bg-primary/15 text-primary' : 'bg-surface-alt text-text-muted'"
                >
                  {{ q.count }}
                </span>
              </button>
            </li>
          </ul>
        </div>
      </aside>
    </div>
  </div>
</template>
