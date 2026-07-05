<script setup lang="ts">
import type { TaskStatus, TaskPriority } from '~/utils/tasks'

const { t } = useI18n()
const supabase = useSupabaseClient()

const { data, pending } = await useAsyncData(
  'reports',
  async () => {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('status, priority, due_date, created_at')

    const rows = tasks ?? []
    const byStatus: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0 }
    const byPriority: Record<TaskPriority, number> = { low: 0, medium: 0, high: 0, critical: 0 }
    let overdue = 0
    const now = new Date()

    // Tasks created per local day (en-CA formats as YYYY-MM-DD).
    const localKey = (d: Date) => d.toLocaleDateString('en-CA')
    const createdByDay = new Map<string, number>()

    for (const tk of rows) {
      if (isTaskStatus(tk.status)) byStatus[tk.status]++
      if (isTaskPriority(tk.priority)) byPriority[tk.priority]++
      if (getDueStatus(tk.due_date, now, tk.status === 'done') === 'overdue') overdue++
      const k = localKey(new Date(tk.created_at))
      createdByDay.set(k, (createdByDay.get(k) ?? 0) + 1)
    }

    // Last 14 days, oldest first.
    const daily: { key: string; label: string; count: number }[] = []
    for (let i = 13; i >= 0; i--) {
      const d = new Date(now)
      d.setDate(d.getDate() - i)
      daily.push({
        key: localKey(d),
        label: String(d.getDate()),
        count: createdByDay.get(localKey(d)) ?? 0
      })
    }

    const total = rows.length
    return {
      total,
      done: byStatus.done,
      completionRate: total ? Math.round((byStatus.done / total) * 100) : 0,
      overdue,
      byStatus,
      byPriority,
      daily,
      dailyMax: Math.max(1, ...daily.map((d) => d.count))
    }
  },
  { lazy: true }
)

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

function widthPct(value: number) {
  const total = data.value?.total ?? 0
  return total ? Math.round((value / total) * 100) : 0
}

const tiles = computed(() => [
  { key: 'totalTasks', value: data.value?.total ?? 0, tint: 'bg-primary/10 text-primary' },
  { key: 'completed', value: data.value?.done ?? 0, tint: 'bg-success/10 text-success' },
  { key: 'completionRate', value: `${data.value?.completionRate ?? 0}%`, tint: 'bg-info/10 text-info' },
  { key: 'overdue', value: data.value?.overdue ?? 0, tint: 'bg-danger/10 text-danger' }
])
</script>

<template>
  <div class="mx-auto max-w-4xl">
    <h1 class="text-2xl font-bold text-text">{{ t('nav.reports') }}</h1>

    <p v-if="pending" class="mt-6 text-text-muted">{{ t('common.loading') }}</p>
    <p
      v-else-if="!data || data.total === 0"
      class="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-text-muted"
    >
      {{ t('reports.empty') }}
    </p>

    <template v-else>
      <div class="mt-6 grid grid-cols-2 gap-4 lg:grid-cols-4">
        <div
          v-for="tile in tiles"
          :key="tile.key"
          class="rounded-2xl border border-border bg-surface p-5 shadow-card"
        >
          <p class="text-3xl font-bold text-text">{{ tile.value }}</p>
          <p class="mt-1 text-sm text-text-muted">{{ t(`reports.${tile.key}`) }}</p>
        </div>
      </div>

      <div class="mt-6 grid gap-4 lg:grid-cols-2">
        <section class="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <h2 class="text-lg font-semibold text-text">{{ t('reports.byStatus') }}</h2>
          <ul class="mt-5 space-y-4">
            <li v-for="s in STATUS_ORDER" :key="s">
              <div class="flex items-center justify-between text-sm">
                <span class="text-text">{{ t(`taskStatus.${s}`) }}</span>
                <span class="text-text-muted">{{ data.byStatus[s] }}</span>
              </div>
              <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-alt">
                <div
                  class="h-full rounded-full"
                  :style="`width:${widthPct(data.byStatus[s])}%;background:${STATUS_COLOR[s]}`"
                />
              </div>
            </li>
          </ul>
        </section>

        <section class="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <h2 class="text-lg font-semibold text-text">{{ t('reports.byPriority') }}</h2>
          <ul class="mt-5 space-y-4">
            <li v-for="p in PRIORITY_ORDER" :key="p">
              <div class="flex items-center justify-between text-sm">
                <span class="text-text">{{ t(`taskPriority.${p}`) }}</span>
                <span class="text-text-muted">{{ data.byPriority[p] }}</span>
              </div>
              <div class="mt-1.5 h-2 overflow-hidden rounded-full bg-surface-alt">
                <div
                  class="h-full rounded-full"
                  :style="`width:${widthPct(data.byPriority[p])}%;background:${PRIORITY_COLOR[p]}`"
                />
              </div>
            </li>
          </ul>
        </section>
      </div>

      <!-- Daily activity (last 14 days) -->
      <section class="mt-4 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <div class="flex items-center justify-between">
          <h2 class="text-lg font-semibold text-text">{{ t('reports.daily') }}</h2>
          <span class="text-sm text-text-muted">{{ t('reports.tasksCreated') }}</span>
        </div>
        <div class="mt-6 flex h-40 items-end gap-1.5">
          <div
            v-for="day in data.daily"
            :key="day.key"
            class="group flex flex-1 flex-col items-center gap-2"
          >
            <div class="flex w-full flex-1 items-end">
              <div
                class="w-full rounded-t bg-primary/80 transition group-hover:bg-primary"
                :style="`height:${Math.max(4, (day.count / data.dailyMax) * 100)}%`"
                :title="`${day.count}`"
              />
            </div>
            <span class="text-[10px] text-text-muted">{{ day.label }}</span>
          </div>
        </div>
      </section>
    </template>
  </div>
</template>
