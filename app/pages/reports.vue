<script setup lang="ts">
import type { TaskStatus, TaskPriority } from '~/utils/tasks'

const { t, locale } = useI18n()
const supabase = useSupabaseClient()

interface Row {
  status: string
  priority: string
  due_date: string | null
  created_at: string
  updated_at: string
}

const { data, pending, refresh } = await useAsyncData(
  'reports',
  async () => {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('status, priority, due_date, created_at, updated_at')
    return { rows: (tasks ?? []) as Row[], fetchedAt: new Date().toISOString() }
  },
  { lazy: true }
)

const allRows = computed(() => data.value?.rows ?? [])

// --- date range ---
type Range = 'month' | '30d' | '90d' | 'all'
const range = ref<Range>('month')
const now = new Date()

const rangeOptions = computed(() => [
  { value: 'month', label: t('reports.rangeMonth') },
  { value: '30d', label: t('reports.range30') },
  { value: '90d', label: t('reports.range90') },
  { value: 'all', label: t('reports.rangeAll') }
])

function startOf(r: Range, ref: Date): Date {
  if (r === 'month') return new Date(ref.getFullYear(), ref.getMonth(), 1)
  if (r === '30d') {
    const d = new Date(ref); d.setDate(d.getDate() - 29); d.setHours(0, 0, 0, 0); return d
  }
  if (r === '90d') {
    const d = new Date(ref); d.setDate(d.getDate() - 89); d.setHours(0, 0, 0, 0); return d
  }
  return new Date(0)
}
const curStart = computed(() => startOf(range.value, now))
// Previous comparable window (skipped for "all time").
const hasPrev = computed(() => range.value !== 'all')
const prevWindow = computed(() => {
  if (range.value === 'month') {
    return { from: new Date(now.getFullYear(), now.getMonth() - 1, 1), to: curStart.value }
  }
  const len = now.getTime() - curStart.value.getTime()
  return { from: new Date(curStart.value.getTime() - len), to: curStart.value }
})

function inRange(iso: string, from: Date, to: Date) {
  const t2 = new Date(iso).getTime()
  return t2 >= from.getTime() && t2 <= to.getTime()
}

const STATUS_ORDER: TaskStatus[] = ['todo', 'in_progress', 'done']
const STATUS_COLOR: Record<TaskStatus, string> = {
  todo: 'var(--tf-color-text-muted)',
  in_progress: 'var(--tf-color-primary)',
  done: 'var(--tf-color-success)'
}
const PRIORITY_ORDER: TaskPriority[] = ['low', 'medium', 'high', 'critical']
const PRIORITY_COLOR: Record<TaskPriority, string> = {
  low: 'var(--tf-color-priority-low)',
  medium: 'var(--tf-color-priority-medium)',
  high: 'var(--tf-color-priority-high)',
  critical: 'var(--tf-color-priority-critical)'
}

function metrics(rows: Row[]) {
  const byStatus: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0 }
  const byPriority: Record<TaskPriority, number> = { low: 0, medium: 0, high: 0, critical: 0 }
  let overdue = 0
  for (const tk of rows) {
    if (isTaskStatus(tk.status)) byStatus[tk.status]++
    if (isTaskPriority(tk.priority)) byPriority[tk.priority]++
    if (getDueStatus(tk.due_date, now, tk.status === 'done') === 'overdue') overdue++
  }
  const total = rows.length
  return { total, done: byStatus.done, overdue, rate: total ? Math.round((byStatus.done / total) * 100) : 0, byStatus, byPriority }
}

const curRows = computed(() =>
  range.value === 'all' ? allRows.value : allRows.value.filter((r) => inRange(r.created_at, curStart.value, now))
)
const cur = computed(() => metrics(curRows.value))
const prev = computed(() =>
  metrics(allRows.value.filter((r) => inRange(r.created_at, prevWindow.value.from, prevWindow.value.to)))
)

const deltas = computed(() => ({
  total: cur.value.total - prev.value.total,
  done: cur.value.done - prev.value.done,
  rate: cur.value.rate - prev.value.rate,
  overdue: cur.value.overdue - prev.value.overdue
}))

const tiles = computed(() => [
  { key: 'totalTasks', value: cur.value.total, delta: deltas.value.total, icon: 'tasks', tint: 'bg-primary/10 text-primary' },
  { key: 'completed', value: cur.value.done, delta: deltas.value.done, icon: 'check', tint: 'bg-success/10 text-success' },
  { key: 'completionRate', value: `${cur.value.rate}%`, delta: deltas.value.rate, suffix: '%', icon: 'trending-up', tint: 'bg-info/10 text-info' },
  { key: 'overdue', value: cur.value.overdue, delta: deltas.value.overdue, icon: 'clock', tint: 'bg-danger/10 text-danger' }
])

// --- status donut (conic gradient) ---
const statusDonut = computed(() => {
  const bs = cur.value.byStatus
  const total = cur.value.total
  if (!total) return 'conic-gradient(var(--tf-color-surface-alt) 0deg 360deg)'
  let acc = 0
  const parts = STATUS_ORDER.map((s) => {
    const from = (acc / total) * 360
    acc += bs[s]
    const to = (acc / total) * 360
    return `${STATUS_COLOR[s]} ${from}deg ${to}deg`
  })
  return `conic-gradient(${parts.join(', ')})`
})
function statusPct(s: TaskStatus) {
  return cur.value.total ? Math.round((cur.value.byStatus[s] / cur.value.total) * 100) : 0
}
const priorityMax = computed(() => Math.max(1, ...PRIORITY_ORDER.map((p) => cur.value.byPriority[p])))

// --- daily line chart (created vs completed per day) ---
const localKey = (d: Date) => d.toLocaleDateString('en-CA')
const dayMaps = computed(() => {
  const created = new Map<string, number>()
  const done = new Map<string, number>()
  for (const tk of allRows.value) {
    const ck = localKey(new Date(tk.created_at))
    created.set(ck, (created.get(ck) ?? 0) + 1)
    if (tk.status === 'done' && tk.updated_at) {
      const dk = localKey(new Date(tk.updated_at))
      done.set(dk, (done.get(dk) ?? 0) + 1)
    }
  }
  return { created, done }
})
const chartStart = computed(() => {
  if (range.value === 'all') {
    const d = new Date(now); d.setDate(d.getDate() - 29); return d
  }
  return curStart.value
})
const chart = computed(() => {
  const days: { key: string; date: Date; created: number; done: number }[] = []
  const d = new Date(chartStart.value.getFullYear(), chartStart.value.getMonth(), chartStart.value.getDate())
  const last = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  while (d <= last) {
    const k = localKey(d)
    days.push({ key: k, date: new Date(d), created: dayMaps.value.created.get(k) ?? 0, done: dayMaps.value.done.get(k) ?? 0 })
    d.setDate(d.getDate() + 1)
  }
  const dailyMax = Math.max(1, ...days.map((x) => Math.max(x.created, x.done)))
  const step = Math.max(1, Math.ceil(days.length / 8))
  return { days, dailyMax, step }
})
function dayShort(date: Date) {
  return date.toLocaleDateString(locale.value, { day: 'numeric', month: 'short' })
}

// --- summary + export ---
function formatDateTime(iso: string) {
  return new Date(iso).toLocaleString(locale.value, { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
}
function exportCsv() {
  const header = ['status', 'priority', 'due_date', 'created_at']
  const lines = [header.join(',')]
  for (const r of curRows.value) lines.push([r.status, r.priority, r.due_date ?? '', r.created_at].join(','))
  const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `teamflow-report-${range.value}.csv`
  a.click()
  URL.revokeObjectURL(url)
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <!-- Header -->
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-text">{{ t('nav.reports') }}</h1>
        <p class="mt-1 text-sm text-text-muted">{{ t('reports.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <div class="w-44"><AppSelect v-model="range" :options="rangeOptions" icon="calendar" /></div>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm font-medium text-text shadow-card transition hover:bg-surface-alt"
          @click="exportCsv"
        >
          <AppIcon name="reports" class="h-4 w-4" />
          {{ t('reports.export') }}
        </button>
      </div>
    </div>

    <p v-if="pending" class="mt-6 text-text-muted">{{ t('common.loading') }}</p>
    <p
      v-else-if="allRows.length === 0"
      class="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-text-muted"
    >
      {{ t('reports.empty') }}
    </p>

    <template v-else>
      <!-- Stat tiles -->
      <div class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div v-for="tile in tiles" :key="tile.key" class="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <div class="flex items-center justify-between">
            <span class="text-sm text-text-muted">{{ t(`reports.${tile.key}`) }}</span>
            <span class="grid h-9 w-9 place-items-center rounded-xl" :class="tile.tint">
              <AppIcon :name="tile.icon" class="h-5 w-5" />
            </span>
          </div>
          <p class="mt-2 text-3xl font-bold text-text">{{ tile.value }}</p>
          <p v-if="hasPrev" class="mt-1 flex items-center gap-1 text-xs">
            <span :class="tile.delta >= 0 ? 'text-success' : 'text-danger'">
              {{ tile.delta >= 0 ? '▲' : '▼' }} {{ tile.delta >= 0 ? '+' : '' }}{{ tile.delta }}{{ tile.suffix ?? '' }}
            </span>
            <span class="text-text-muted">{{ t('reports.fromPrev') }}</span>
          </p>
        </div>
      </div>

      <!-- Status donut + priority bars -->
      <div class="mt-4 grid gap-4 lg:grid-cols-2">
        <section class="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <h2 class="text-lg font-semibold text-text">{{ t('reports.byStatus') }}</h2>
          <div class="mt-5 flex flex-wrap items-center gap-6">
            <div class="relative grid h-40 w-40 shrink-0 place-items-center rounded-full" :style="{ background: statusDonut }">
              <div class="grid h-24 w-24 place-items-center rounded-full bg-surface text-center">
                <div>
                  <p class="text-2xl font-bold text-text">{{ cur.total }}</p>
                  <p class="text-[11px] text-text-muted">{{ t('reports.totalTasks') }}</p>
                </div>
              </div>
            </div>
            <ul class="min-w-[10rem] flex-1 space-y-3">
              <li v-for="s in STATUS_ORDER" :key="s" class="flex items-center gap-2 text-sm">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ background: STATUS_COLOR[s] }" />
                <span class="flex-1 text-text">{{ t(`taskStatus.${s}`) }}</span>
                <span class="text-text-muted">{{ cur.byStatus[s] }} ({{ statusPct(s) }}%)</span>
              </li>
            </ul>
          </div>
        </section>

        <section class="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <h2 class="text-lg font-semibold text-text">{{ t('reports.byPriority') }}</h2>
          <ul class="mt-5 space-y-4">
            <li v-for="p in PRIORITY_ORDER" :key="p">
              <div class="mb-1.5 flex items-center gap-2 text-sm">
                <span class="h-2.5 w-2.5 shrink-0 rounded-full" :style="{ background: PRIORITY_COLOR[p] }" />
                <span class="flex-1 text-text">{{ t(`taskPriority.${p}`) }}</span>
                <span class="text-text-muted">{{ cur.byPriority[p] }}</span>
              </div>
              <div class="h-2 overflow-hidden rounded-full bg-surface-alt">
                <div
                  class="h-full rounded-full transition-all"
                  :style="`width:${(cur.byPriority[p] / priorityMax) * 100}%;background:${PRIORITY_COLOR[p]}`"
                />
              </div>
            </li>
          </ul>
        </section>
      </div>

      <!-- Daily chart + overall summary -->
      <div class="mt-4 grid gap-4 lg:grid-cols-3">
        <section class="rounded-2xl border border-border bg-surface p-6 shadow-card lg:col-span-2">
          <div class="flex flex-wrap items-center justify-between gap-2">
            <h2 class="text-lg font-semibold text-text">{{ t('reports.dailyReport') }}</h2>
            <div class="flex items-center gap-4 text-xs">
              <span class="flex items-center gap-1.5 text-text-muted">
                <span class="h-2.5 w-2.5 rounded-full bg-primary" />{{ t('reports.seriesCreated') }}
              </span>
              <span class="flex items-center gap-1.5 text-text-muted">
                <span class="h-2.5 w-2.5 rounded-full bg-success" />{{ t('reports.seriesDone') }}
              </span>
            </div>
          </div>

          <div class="mt-5 flex gap-2.5">
            <!-- y-axis scale -->
            <div class="flex h-56 flex-col justify-between text-right text-[10px] leading-none text-text-muted">
              <span>{{ chart.dailyMax }}</span>
              <span>{{ Math.round(chart.dailyMax / 2) }}</span>
              <span>0</span>
            </div>
            <div class="relative h-56 flex-1">
              <!-- gridlines -->
              <div class="pointer-events-none absolute inset-0 flex flex-col justify-between">
                <span class="border-t border-dashed border-border/60" />
                <span class="border-t border-dashed border-border/60" />
                <span class="border-t border-border" />
              </div>
              <!-- bars -->
              <div class="relative flex h-full items-end gap-0.5">
                <div
                  v-for="day in chart.days"
                  :key="day.key"
                  class="group flex h-full flex-1 flex-col items-center justify-end"
                >
                  <div class="flex w-full flex-1 items-end justify-center gap-0.5 pb-px">
                    <div
                      class="w-[46%] max-w-[20px] rounded-t bg-primary transition group-hover:opacity-75"
                      :style="`height:${(day.created / chart.dailyMax) * 100}%`"
                      :title="`${dayShort(day.date)} · ${t('reports.seriesCreated')}: ${day.created}`"
                    />
                    <div
                      class="w-[46%] max-w-[20px] rounded-t bg-success transition group-hover:opacity-75"
                      :style="`height:${(day.done / chart.dailyMax) * 100}%`"
                      :title="`${dayShort(day.date)} · ${t('reports.seriesDone')}: ${day.done}`"
                    />
                  </div>
                </div>
              </div>
            </div>
          </div>
          <!-- x-axis labels (aligned under the plot, past the y-axis gutter) -->
          <div class="mt-1.5 flex gap-0.5 pl-[calc(2ch+0.625rem)]">
            <div v-for="(day, i) in chart.days" :key="`l-${day.key}`" class="flex-1 text-center">
              <span v-if="i % chart.step === 0 || i === chart.days.length - 1" class="text-[10px] text-text-muted">
                {{ dayShort(day.date) }}
              </span>
            </div>
          </div>
        </section>

        <!-- Overall summary -->
        <section class="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <h2 class="text-lg font-semibold text-text">{{ t('reports.summaryTitle') }}</h2>
          <ul class="mt-4 space-y-3 text-sm">
            <li class="flex items-center gap-2.5">
              <span class="grid h-7 w-7 place-items-center rounded-lg bg-primary/10 text-primary"><AppIcon name="tasks" class="h-4 w-4" /></span>
              <span class="flex-1 text-text-muted">{{ t('reports.created') }}</span>
              <span class="font-semibold text-text">{{ cur.total }}</span>
            </li>
            <li class="flex items-center gap-2.5">
              <span class="grid h-7 w-7 place-items-center rounded-lg bg-success/10 text-success"><AppIcon name="check" class="h-4 w-4" /></span>
              <span class="flex-1 text-text-muted">{{ t('taskStatus.done') }}</span>
              <span class="font-semibold text-text">{{ cur.done }}</span>
            </li>
            <li class="flex items-center gap-2.5">
              <span class="grid h-7 w-7 place-items-center rounded-lg bg-info/10 text-info"><AppIcon name="activity" class="h-4 w-4" /></span>
              <span class="flex-1 text-text-muted">{{ t('taskStatus.in_progress') }}</span>
              <span class="font-semibold text-text">{{ cur.byStatus.in_progress }}</span>
            </li>
            <li class="flex items-center gap-2.5">
              <span class="grid h-7 w-7 place-items-center rounded-lg bg-danger/10 text-danger"><AppIcon name="clock" class="h-4 w-4" /></span>
              <span class="flex-1 text-text-muted">{{ t('reports.overdue') }}</span>
              <span class="font-semibold text-text">{{ cur.overdue }}</span>
            </li>
          </ul>
          <div class="mt-5 flex items-center justify-between border-t border-border pt-4 text-xs text-text-muted">
            <span>{{ t('reports.lastUpdated') }} {{ data ? formatDateTime(data.fetchedAt) : '' }}</span>
            <button type="button" class="rounded-lg p-1.5 transition hover:bg-surface-alt hover:text-text" :title="t('reports.refresh')" @click="refresh()">
              <AppIcon name="refresh" class="h-4 w-4" :class="pending ? 'animate-spin' : ''" />
            </button>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
