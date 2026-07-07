<script setup lang="ts">
import type { DueStatus } from '~/utils/dates'
import type { TaskStatus } from '~/utils/tasks'

type TaskBucket = 'done' | 'in_progress' | 'pending' | 'due_soon' | 'overdue'

const { t, locale } = useI18n()
const supabase = useSupabaseClient()

const { data, pending } = await useAsyncData(
  'dashboard',
  async () => {
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id ?? ''
    const name =
      (uid
        ? (
            await supabase
              .from('user_profiles')
              .select('display_name')
              .eq('id', uid)
              .single()
          ).data?.display_name
        : null) ||
      auth.user?.email?.split('@')[0] ||
      'there'

    const [
      myWs,
      projectsCount,
      membersCount,
      tasksRes,
      dueSoonRes,
      recentProjects,
      actTasksRes,
      actProjectsRes
    ] = await Promise.all([
      supabase
        .from('workspace_members')
        .select('workspace_id', { count: 'exact', head: true })
        .eq('user_id', uid),
      supabase.from('projects').select('id', { count: 'exact', head: true }),
      supabase.from('workspace_members').select('user_id', { count: 'exact', head: true }),
      supabase.from('tasks').select('status, due_date, created_at'),
      supabase
        .from('tasks')
        .select('id, title, due_date, status, project:projects (name)')
        .neq('status', 'done')
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true })
        .limit(5),
      supabase
        .from('projects')
        .select('id, name, created_at, workspace:workspaces (name)')
        .order('created_at', { ascending: false })
        .limit(4),
      supabase
        .from('tasks')
        .select(
          'id, title, created_at, creator:user_profiles!tasks_created_by_fkey (display_name, avatar_url)'
        )
        .order('created_at', { ascending: false })
        .limit(5),
      supabase
        .from('projects')
        .select(
          'id, name, created_at, creator:user_profiles!projects_created_by_fkey (display_name, avatar_url)'
        )
        .order('created_at', { ascending: false })
        .limit(5)
    ])

    // Five mutually-exclusive status buckets + tasks-created-per-month map.
    const now = new Date()
    const buckets: Record<TaskBucket, number> = {
      done: 0,
      in_progress: 0,
      pending: 0,
      due_soon: 0,
      overdue: 0
    }
    const monthCount: Record<string, number> = {}
    for (const row of tasksRes.data ?? []) {
      if (row.status === 'done') buckets.done++
      else {
        const due = getDueStatus(row.due_date, now, false)
        if (due === 'overdue') buckets.overdue++
        else if (due === 'due-soon') buckets.due_soon++
        else if (row.status === 'in_progress') buckets.in_progress++
        else buckets.pending++
      }
      const d = new Date(row.created_at)
      const key = `${d.getFullYear()}-${d.getMonth()}`
      monthCount[key] = (monthCount[key] ?? 0) + 1
    }

    // Merge recent tasks + projects into one activity feed.
    const activity = [
      ...(actTasksRes.data ?? []).map((tk) => ({
        id: `t-${tk.id}`,
        at: tk.created_at,
        actor: tk.creator?.display_name ?? null,
        avatar: tk.creator?.avatar_url ?? null,
        verb: 'activity.createdTask',
        title: tk.title,
        link: `/tasks/${tk.id}`
      })),
      ...(actProjectsRes.data ?? []).map((p) => ({
        id: `p-${p.id}`,
        at: p.created_at,
        actor: p.creator?.display_name ?? null,
        avatar: p.creator?.avatar_url ?? null,
        verb: 'activity.createdProject',
        title: p.name,
        link: `/projects/${p.id}`
      }))
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 5)

    return {
      name,
      counts: {
        workspaces: myWs.count ?? 0,
        projects: projectsCount.count ?? 0,
        tasks: (tasksRes.data ?? []).length,
        members: membersCount.count ?? 0
      },
      buckets,
      monthCount,
      dueSoon: (dueSoonRes.data ?? []).map((tk) => ({
        ...tk,
        status: isTaskStatus(tk.status) ? tk.status : 'todo'
      })),
      recentProjects: recentProjects.data ?? [],
      activity
    }
  },
  { lazy: true }
)

const today = computed(() =>
  new Date().toLocaleDateString(locale.value, {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
    year: 'numeric'
  })
)

const stats = computed(() => [
  { key: 'workspaces', icon: 'workspace', value: data.value?.counts.workspaces ?? 0, tint: 'bg-primary/10 text-primary' },
  { key: 'projects', icon: 'projects', value: data.value?.counts.projects ?? 0, tint: 'bg-success/10 text-success' },
  { key: 'tasks', icon: 'tasks', value: data.value?.counts.tasks ?? 0, tint: 'bg-warning/10 text-warning' },
  { key: 'members', icon: 'members', value: data.value?.counts.members ?? 0, tint: 'bg-brand-accent/10 text-brand-accent' }
] as const)

// --- donut (5 buckets) ---
const BUCKET_META: { key: TaskBucket; color: string; label: string }[] = [
  { key: 'done', color: 'var(--tf-color-success)', label: 'taskStatus.done' },
  { key: 'in_progress', color: 'var(--tf-color-primary)', label: 'taskStatus.in_progress' },
  { key: 'pending', color: 'var(--tf-color-status-pending)', label: 'dashboard.pending' },
  { key: 'due_soon', color: 'var(--tf-color-status-duesoon)', label: 'dashboard.dueSoon' },
  { key: 'overdue', color: 'var(--tf-color-danger)', label: 'dashboard.overdue' }
]

function bucketTotal() {
  const b = data.value?.buckets
  return b ? BUCKET_META.reduce((s, m) => s + b[m.key], 0) : 0
}

const donut = computed(() => {
  const b = data.value?.buckets
  const total = bucketTotal()
  if (!b || total === 0) return { style: 'background: var(--tf-color-surface-alt);', total: 0 }
  let acc = 0
  const stops = BUCKET_META.filter((m) => b[m.key] > 0).map((m) => {
    const start = (acc / total) * 100
    acc += b[m.key]
    const end = (acc / total) * 100
    return `${m.color} ${start}% ${end}%`
  })
  return { style: `background: conic-gradient(${stops.join(', ')});`, total }
})

function bucketPct(key: TaskBucket) {
  const b = data.value?.buckets
  const total = bucketTotal()
  return total ? Math.round((b![key] / total) * 100) : 0
}

// --- monthly line chart (last 8 months) ---
const CHART_W = 320
const CHART_H = 120
const PAD = 10

const monthly = computed(() => {
  const mc = data.value?.monthCount ?? {}
  const now = new Date()
  const out: { label: string; count: number }[] = []
  for (let i = 7; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1)
    out.push({
      label: d.toLocaleDateString(locale.value, { month: 'short' }),
      count: mc[`${d.getFullYear()}-${d.getMonth()}`] ?? 0
    })
  }
  return out
})

const chartPoints = computed(() => {
  const m = monthly.value
  const max = Math.max(1, ...m.map((d) => d.count))
  const innerW = CHART_W - PAD * 2
  const innerH = CHART_H - PAD * 2
  const stepX = innerW / Math.max(1, m.length - 1)
  return m.map((d, i) => ({
    ...d,
    x: PAD + i * stepX,
    y: PAD + innerH * (1 - d.count / max)
  }))
})

const linePath = computed(() =>
  chartPoints.value.map((p, i) => `${i ? 'L' : 'M'}${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
)
const areaPath = computed(() => {
  const pts = chartPoints.value
  if (!pts.length) return ''
  const bottom = CHART_H - PAD
  const mid = pts.map((p) => `L${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ')
  return `M${pts[0].x.toFixed(1)} ${bottom} ${mid} L${pts[pts.length - 1].x.toFixed(1)} ${bottom} Z`
})

// --- display helpers ---
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value, { day: 'numeric', month: 'short' })
}

const DUE_CLASSES: Record<DueStatus, string> = {
  overdue: 'text-danger font-medium',
  'due-soon': 'text-warning font-medium',
  upcoming: 'text-text-muted',
  none: 'text-text-muted'
}

const STATUS_COLOR: Record<TaskStatus, string> = {
  done: 'var(--tf-color-success)',
  in_progress: 'var(--tf-color-primary)',
  todo: 'var(--tf-color-status-pending)'
}

const RT_UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
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
  for (const [unit, secs] of RT_UNITS) {
    if (diff >= secs) return rtf.format(-Math.floor(diff / secs), unit)
  }
  return rtf.format(0, 'second')
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <!-- Header -->
    <div class="flex flex-wrap items-end justify-between gap-2">
      <h1 class="text-2xl font-bold text-text">{{ t('nav.dashboard') }}</h1>
      <p class="text-sm text-text-muted">{{ today }}</p>
    </div>

    <!-- Stat cards -->
    <div class="mt-5 grid grid-cols-2 gap-4 lg:grid-cols-4">
      <div
        v-for="stat in stats"
        :key="stat.key"
        class="flex items-center gap-4 rounded-2xl border border-border bg-surface p-4 shadow-card transition duration-200 hover:-translate-y-0.5 hover:shadow-glow"
      >
        <div class="grid h-12 w-12 shrink-0 place-items-center rounded-xl" :class="stat.tint">
          <AppIcon :name="stat.icon" class="h-6 w-6" />
        </div>
        <div class="min-w-0">
          <p class="truncate text-sm text-text-muted">{{ t(`dashboard.stats.${stat.key}`) }}</p>
          <p class="text-2xl font-bold text-text">{{ stat.value }}</p>
        </div>
      </div>
    </div>

    <!-- Task overview + monthly line chart -->
    <div class="mt-4 grid gap-4 lg:grid-cols-2">
      <section class="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 class="text-lg font-semibold text-text">{{ t('dashboard.taskOverview') }}</h2>
        <div class="mt-5 flex flex-col items-center gap-6 sm:flex-row">
          <div class="relative grid h-36 w-36 shrink-0 place-items-center rounded-full" :style="donut.style">
            <div class="grid h-24 w-24 place-items-center rounded-full bg-surface text-center">
              <div>
                <p class="text-2xl font-bold text-text">{{ donut.total }}</p>
                <p class="text-xs text-text-muted">{{ t('dashboard.stats.tasks') }}</p>
              </div>
            </div>
          </div>
          <ul class="flex-1 space-y-2.5">
            <li v-for="m in BUCKET_META" :key="m.key" class="flex items-center gap-3 text-sm">
              <span class="h-3 w-3 shrink-0 rounded-full" :style="`background:${m.color}`" />
              <span class="flex-1 text-text">{{ t(m.label) }}</span>
              <span class="font-medium text-text">{{ data?.buckets[m.key] ?? 0 }}</span>
              <span class="w-12 text-right text-text-muted">{{ bucketPct(m.key) }}%</span>
            </li>
          </ul>
        </div>
      </section>

      <section class="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 class="text-lg font-semibold text-text">{{ t('dashboard.monthlyTasks') }}</h2>
        <div class="mt-5 text-primary">
          <svg :viewBox="`0 0 ${CHART_W} ${CHART_H}`" class="h-40 w-full overflow-visible">
            <path :d="areaPath" fill="currentColor" fill-opacity="0.10" />
            <path
              :d="linePath"
              fill="none"
              stroke="currentColor"
              stroke-width="2.5"
              stroke-linecap="round"
              stroke-linejoin="round"
            />
            <circle
              v-for="p in chartPoints"
              :key="p.label"
              :cx="p.x"
              :cy="p.y"
              r="3"
              fill="var(--tf-color-surface)"
              stroke="currentColor"
              stroke-width="2"
            />
          </svg>
          <div class="mt-2 flex justify-between px-1 text-[10px] text-text-muted">
            <span v-for="p in chartPoints" :key="p.label">{{ p.label }}</span>
          </div>
        </div>
      </section>
    </div>

    <!-- Deadlines / recent projects / activity -->
    <div class="mt-4 grid gap-4 lg:grid-cols-3">
      <!-- Upcoming deadlines -->
      <section class="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <h2 class="text-lg font-semibold text-text">{{ t('dashboard.deadlines') }}</h2>
        <p v-if="pending" class="mt-4 text-sm text-text-muted">{{ t('common.loading') }}</p>
        <p
          v-else-if="!data || data.dueSoon.length === 0"
          class="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted"
        >
          {{ t('dashboard.noDueSoon') }}
        </p>
        <ul v-else class="mt-4 space-y-1">
          <li v-for="tk in data.dueSoon" :key="tk.id">
            <NuxtLink :to="`/tasks/${tk.id}`" class="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-alt">
              <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="`background:${STATUS_COLOR[tk.status]}`" />
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-text">{{ tk.title }}</span>
                <span class="block truncate text-xs text-text-muted">{{ tk.project?.name }}</span>
              </span>
              <span
                class="shrink-0 text-xs"
                :class="DUE_CLASSES[getDueStatus(tk.due_date, new Date(), false)]"
              >
                {{ tk.due_date ? formatDate(tk.due_date) : '' }}
              </span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <!-- Recent projects -->
      <section class="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-text">{{ t('dashboard.recentProjects') }}</h2>
          <NuxtLink to="/projects" class="text-sm font-medium text-primary hover:underline">
            {{ t('dashboard.viewAll') }}
          </NuxtLink>
        </div>
        <p
          v-if="!pending && (!data || data.recentProjects.length === 0)"
          class="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted"
        >
          {{ t('dashboard.noProjects') }}
        </p>
        <ul v-else class="mt-4 space-y-1">
          <li v-for="p in data?.recentProjects ?? []" :key="p.id">
            <NuxtLink :to="`/projects/${p.id}`" class="flex items-center gap-3 rounded-lg px-2 py-2 hover:bg-surface-alt">
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <AppIcon name="projects" class="h-5 w-5" />
              </span>
              <span class="min-w-0 flex-1">
                <span class="block truncate text-sm font-medium text-text">{{ p.name }}</span>
                <span class="block truncate text-xs text-text-muted">{{ p.workspace?.name }}</span>
              </span>
            </NuxtLink>
          </li>
        </ul>
      </section>

      <!-- Recent activity -->
      <section class="rounded-2xl border border-border bg-surface p-5 shadow-card">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-text">{{ t('dashboard.recentActivity') }}</h2>
          <NuxtLink to="/activity" class="text-sm font-medium text-primary hover:underline">
            {{ t('dashboard.viewAll') }}
          </NuxtLink>
        </div>
        <p
          v-if="!pending && (!data || data.activity.length === 0)"
          class="mt-4 rounded-xl border border-dashed border-border p-6 text-center text-sm text-text-muted"
        >
          {{ t('activity.empty') }}
        </p>
        <ul v-else class="mt-4 space-y-3">
          <li v-for="item in data?.activity ?? []" :key="item.id">
            <NuxtLink :to="item.link" class="flex items-start gap-3">
              <img
                v-if="item.avatar"
                :src="item.avatar"
                alt=""
                class="h-8 w-8 shrink-0 rounded-full object-cover"
              />
              <div
                v-else
                class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-alt text-xs font-medium text-text-muted"
              >
                {{ (item.actor ?? '?').charAt(0).toUpperCase() }}
              </div>
              <div class="min-w-0 flex-1">
                <p class="text-sm text-text">
                  <span class="font-medium">{{ item.actor ?? '—' }}</span>
                  <span class="text-text-muted"> {{ t(item.verb) }} </span>
                  <span class="font-medium">{{ item.title }}</span>
                </p>
                <p class="text-xs text-text-muted">{{ timeAgo(item.at) }}</p>
              </div>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
