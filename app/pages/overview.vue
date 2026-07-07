<script setup lang="ts">
import type { CompanyDashboard } from '~/stores/workspaces'
import { TASK_TYPES } from '~/utils/tasks'

// Company-owner overview: a single cross-team dashboard rolled up client-side
// over existing RLS (see the store's fetchOverview). All numbers are real —
// no time-tracking placeholders.
const { t, locale } = useI18n()
const store = useWorkspacesStore()

const EMPTY: CompanyDashboard = {
  totals: { teams: 0, projects: 0, tasks: 0, done: 0, members: 0 },
  status: { todo: 0, in_progress: 0, done: 0 },
  overdue: 0,
  dueSoon: 0,
  types: { dev: 0, design: 0, test: 0, other: 0 },
  members: [],
  recentProjects: [],
  activity: []
}
const data = ref<CompanyDashboard>(EMPTY)

const { pending } = await useAsyncData('company-overview', async () => {
  data.value = await store.fetchOverview()
  return true
}, { lazy: true })

const isEmpty = computed(() => data.value.totals.teams === 0)
const companyPct = computed(() =>
  data.value.totals.tasks
    ? Math.round((data.value.totals.done / data.value.totals.tasks) * 100)
    : 0
)

// --- theme colors (kept as CSS vars so both light/dark modes track) ---
const C = {
  primary: 'var(--tf-color-primary)',
  success: 'var(--tf-color-success)',
  warning: 'var(--tf-color-warning)',
  danger: 'var(--tf-color-danger)',
  info: 'var(--tf-color-info)',
  accent: 'var(--tf-color-brand-accent)',
  muted: 'var(--tf-color-text-muted)'
}

// Build a conic-gradient donut ring from weighted segments. Empty → flat ring.
function donut(segments: { value: number; color: string }[]) {
  const total = segments.reduce((s, x) => s + x.value, 0)
  if (total === 0) return 'var(--tf-color-surface-alt)'
  const stops: string[] = []
  let acc = 0
  for (const s of segments) {
    if (s.value === 0) continue
    const from = (acc / total) * 100
    acc += s.value
    const to = (acc / total) * 100
    stops.push(`${s.color} ${from}% ${to}%`)
  }
  return `conic-gradient(${stops.join(', ')})`
}

const statusSegments = computed(() => [
  { value: data.value.status.done, color: C.success },
  { value: data.value.status.in_progress, color: C.primary },
  { value: data.value.status.todo, color: C.muted }
])
const typeSegments = computed(() =>
  TASK_TYPES.map((ty) => ({ value: data.value.types[ty], color: TYPE_COLOR[ty] }))
)

const TYPE_COLOR: Record<string, string> = {
  dev: C.primary,
  design: C.accent,
  test: C.warning,
  other: C.muted
}

// Legend rows for the progress donut.
const statusLegend = computed(() => [
  { key: 'tasksDone', color: C.success, value: data.value.status.done },
  { key: 'inProgress', color: C.primary, value: data.value.status.in_progress },
  { key: 'todo', color: C.muted, value: data.value.status.todo },
  { key: 'dueSoon', color: C.warning, value: data.value.dueSoon },
  { key: 'overdue', color: C.danger, value: data.value.overdue }
])
function statusPct(v: number) {
  return data.value.totals.tasks ? Math.round((v / data.value.totals.tasks) * 100) : 0
}
function typePct(v: number) {
  return data.value.totals.tasks ? Math.round((v / data.value.totals.tasks) * 100) : 0
}

// --- helpers ---
function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || '??'
}
function fmtDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}
function fmtDateTime(iso: string) {
  return new Date(iso).toLocaleString(locale.value, {
    day: 'numeric',
    month: 'short',
    hour: '2-digit',
    minute: '2-digit'
  })
}
function projectPct(p: { taskTotal: number; taskDone: number }) {
  return p.taskTotal ? Math.round((p.taskDone / p.taskTotal) * 100) : 0
}
const todayLabel = computed(() =>
  new Date().toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric' })
)

const STATS = computed(() => [
  { key: 'teams', icon: 'members', tint: 'bg-primary/10 text-primary', value: data.value.totals.teams },
  { key: 'projects', icon: 'projects', tint: 'bg-success/10 text-success', value: data.value.totals.projects },
  { key: 'tasks', icon: 'tasks', tint: 'bg-warning/10 text-warning', value: data.value.totals.tasks },
  { key: 'completion', icon: 'trending-up', tint: 'bg-info/10 text-info', value: `${companyPct.value}%` },
  { key: 'members', icon: 'user', tint: 'bg-brand-accent/10 text-brand-accent', value: data.value.totals.members }
] as const)

const ROLE_BADGE: Record<string, string> = {
  owner: 'bg-primary/10 text-primary',
  admin: 'bg-info/10 text-info',
  member: 'bg-surface-alt text-text',
  viewer: 'bg-surface-alt text-text-muted'
}

const ACTIVITY_META: Record<string, { icon: string; tint: string }> = {
  project_created: { icon: 'projects', tint: 'bg-primary/10 text-primary' },
  task_created: { icon: 'plus', tint: 'bg-info/10 text-info' },
  task_done: { icon: 'check', tint: 'bg-success/10 text-success' }
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <!-- header -->
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div class="flex items-center gap-3">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <AppIcon name="building" class="h-6 w-6" />
        </span>
        <div>
          <h1 class="text-2xl font-bold text-text">{{ t('overview.title') }}</h1>
          <p class="mt-0.5 text-sm text-text-muted">{{ t('overview.subtitle') }}</p>
        </div>
      </div>
      <span class="inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text-muted shadow-card">
        <AppIcon name="calendar" class="h-4 w-4" />
        {{ todayLabel }}
      </span>
    </div>

    <p v-if="pending" class="mt-8 text-text-muted">{{ t('common.loading') }}</p>

    <p
      v-else-if="isEmpty"
      class="mt-8 rounded-2xl border border-dashed border-border p-10 text-center text-text-muted"
    >
      {{ t('overview.empty') }}
    </p>

    <template v-else>
      <!-- stat cards -->
      <div class="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-5">
        <div
          v-for="s in STATS"
          :key="s.key"
          class="min-w-0 rounded-2xl border border-border bg-surface p-4 shadow-card"
        >
          <div class="flex items-center justify-between gap-2">
            <p class="min-w-0 truncate text-sm text-text-muted">{{ t(`overview.${s.key}`) }}</p>
            <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg" :class="s.tint">
              <AppIcon :name="s.icon" class="h-5 w-5" />
            </span>
          </div>
          <p class="mt-3 text-2xl font-bold text-text">{{ s.value }}</p>
        </div>
      </div>

      <!-- donuts -->
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <!-- project progress -->
        <section class="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h2 class="font-semibold text-text">{{ t('overview.progressTitle') }}</h2>
          <div class="mt-4 flex flex-col items-center gap-6 sm:flex-row">
            <div class="relative h-36 w-36 shrink-0">
              <div class="h-full w-full rounded-full" :style="{ background: donut(statusSegments) }" />
              <div class="absolute inset-[22%] grid place-items-center rounded-full bg-surface text-center">
                <div>
                  <p class="text-2xl font-bold text-text">{{ companyPct }}%</p>
                  <p class="text-xs text-text-muted">{{ t('overview.tasksDone') }}</p>
                </div>
              </div>
            </div>
            <ul class="flex-1 space-y-2 text-sm">
              <li
                v-for="row in statusLegend"
                :key="row.key"
                class="flex items-center gap-2"
              >
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ background: row.color }" />
                <span class="text-text-muted">{{ t(`overview.${row.key}`) }}</span>
                <span class="ml-auto font-medium text-text">{{ row.value }}</span>
                <span class="w-10 text-right text-xs text-text-muted">{{ statusPct(row.value) }}%</span>
              </li>
            </ul>
          </div>
        </section>

        <!-- task type -->
        <section class="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h2 class="font-semibold text-text">{{ t('overview.taskTypes') }}</h2>
          <div class="mt-4 flex flex-col items-center gap-6 sm:flex-row">
            <div class="relative h-36 w-36 shrink-0">
              <div class="h-full w-full rounded-full" :style="{ background: donut(typeSegments) }" />
              <div class="absolute inset-[22%] grid place-items-center rounded-full bg-surface text-center">
                <div>
                  <p class="text-2xl font-bold text-text">{{ data.totals.tasks }}</p>
                  <p class="text-xs text-text-muted">{{ t('overview.tasks') }}</p>
                </div>
              </div>
            </div>
            <ul class="flex-1 space-y-2 text-sm">
              <li v-for="ty in TASK_TYPES" :key="ty" class="flex items-center gap-2">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ background: TYPE_COLOR[ty] }" />
                <span class="text-text-muted">{{ t(`taskType.${ty}`) }}</span>
                <span class="ml-auto font-medium text-text">{{ data.types[ty] }}</span>
                <span class="w-10 text-right text-xs text-text-muted">{{ typePct(data.types[ty]) }}%</span>
              </li>
            </ul>
          </div>
        </section>
      </div>

      <!-- bottom panels -->
      <div class="mt-4 grid gap-4 lg:grid-cols-3">
        <!-- company members -->
        <section class="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-text">{{ t('overview.companyMembers') }}</h2>
            <span class="text-xs text-text-muted">{{ t('overview.totalPeople', { count: data.members.length }) }}</span>
          </div>
          <p v-if="data.members.length === 0" class="mt-4 text-sm text-text-muted">
            {{ t('overview.noMembers') }}
          </p>
          <ul v-else class="mt-4 space-y-2.5">
            <li v-for="m in data.members" :key="m.id" class="flex items-center gap-3">
              <img
                v-if="m.avatar"
                :src="m.avatar"
                :alt="m.name"
                class="h-9 w-9 rounded-full object-cover"
              />
              <span
                v-else
                class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary"
              >
                {{ initials(m.name) }}
              </span>
              <span class="min-w-0 flex-1 truncate text-sm font-medium text-text">{{ m.name }}</span>
              <span class="rounded-full px-2.5 py-0.5 text-xs font-medium" :class="ROLE_BADGE[m.role]">
                {{ t(`role.${m.role}`) }}
              </span>
            </li>
          </ul>
        </section>

        <!-- recent projects -->
        <section class="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-text">{{ t('overview.recentProjects') }}</h2>
            <NuxtLink to="/workspaces" class="text-xs font-medium text-primary hover:underline">
              {{ t('overview.viewAll') }}
            </NuxtLink>
          </div>
          <p v-if="data.recentProjects.length === 0" class="mt-4 text-sm text-text-muted">
            {{ t('overview.noProjects') }}
          </p>
          <ul v-else class="mt-4 space-y-4">
            <li v-for="p in data.recentProjects" :key="p.id">
              <NuxtLink :to="`/projects/${p.id}`" class="block">
                <div class="flex items-center justify-between gap-2">
                  <span class="truncate text-sm font-medium text-text hover:text-primary">{{ p.name }}</span>
                  <span class="shrink-0 text-xs font-medium text-text-muted">{{ projectPct(p) }}%</span>
                </div>
                <p class="mt-0.5 text-xs text-text-muted">{{ t('overview.createdOn', { date: fmtDate(p.createdAt) }) }}</p>
                <div class="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-surface-alt">
                  <div class="h-full rounded-full bg-primary" :style="{ width: projectPct(p) + '%' }" />
                </div>
                <div class="mt-1.5 flex gap-3 text-xs text-text-muted">
                  <span>{{ p.memberCount }} {{ t('overview.members') }}</span>
                  <span>{{ p.taskDone }}/{{ p.taskTotal }} {{ t('overview.tasks') }}</span>
                </div>
              </NuxtLink>
            </li>
          </ul>
        </section>

        <!-- recent activity -->
        <section class="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h2 class="font-semibold text-text">{{ t('overview.recentActivity') }}</h2>
          <p v-if="data.activity.length === 0" class="mt-4 text-sm text-text-muted">
            {{ t('overview.noActivity') }}
          </p>
          <ul v-else class="mt-4 space-y-3">
            <li v-for="a in data.activity" :key="a.id" class="flex gap-3">
              <span
                class="grid h-8 w-8 shrink-0 place-items-center rounded-lg"
                :class="ACTIVITY_META[a.kind].tint"
              >
                <AppIcon :name="ACTIVITY_META[a.kind].icon" class="h-4 w-4" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm text-text">
                  <span class="text-text-muted">{{ t(`overview.act.${a.kind}`) }}</span>
                  <span class="font-medium"> {{ a.title }}</span>
                </p>
                <p class="truncate text-xs text-text-muted">
                  <span v-if="a.context">{{ t('overview.inContext', { name: a.context }) }}</span>
                  <span v-if="a.actor"> · {{ t('overview.by', { name: a.actor }) }}</span>
                </p>
              </div>
              <span class="shrink-0 text-xs text-text-muted">{{ fmtDateTime(a.at) }}</span>
            </li>
          </ul>
        </section>
      </div>
    </template>
  </div>
</template>
