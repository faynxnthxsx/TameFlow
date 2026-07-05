<script setup lang="ts">
import type { TaskStatus } from '~/utils/tasks'

const { t, locale } = useI18n()
const supabase = useSupabaseClient()

interface CalTask {
  id: string
  title: string
  priority: string
  status: TaskStatus
  due_date: string
}

const { data } = await useAsyncData(
  'calendar-tasks',
  async () => {
    const { data: tasks } = await supabase
      .from('tasks')
      .select('id, title, priority, status, due_date, project:projects (name)')
      .not('due_date', 'is', null)
      .order('due_date', { ascending: true })
    return { tasks: (tasks ?? []) as CalTask[] }
  },
  { lazy: true }
)

const cursor = ref(new Date(new Date().getFullYear(), new Date().getMonth(), 1))

function pad(n: number) {
  return String(n).padStart(2, '0')
}
function dayKey(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
}

// A due_date ('YYYY-MM-DD') maps straight to a cell key.
const tasksByDay = computed(() => {
  const map: Record<string, CalTask[]> = {}
  for (const tk of data.value?.tasks ?? []) {
    ;(map[tk.due_date] ??= []).push(tk)
  }
  return map
})

const monthLabel = computed(() =>
  cursor.value.toLocaleDateString(locale.value, { month: 'long', year: 'numeric' })
)

// Weekday headers, Sunday-first, localized (2024-01-07 is a Sunday).
const weekdays = computed(() =>
  Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(locale.value, { weekday: 'short' })
  )
)

const cells = computed<(Date | null)[]>(() => {
  const y = cursor.value.getFullYear()
  const m = cursor.value.getMonth()
  const lead = new Date(y, m, 1).getDay()
  const days = new Date(y, m + 1, 0).getDate()
  const out: (Date | null)[] = Array.from({ length: lead }, () => null)
  for (let d = 1; d <= days; d++) out.push(new Date(y, m, d))
  return out
})

const todayKey = dayKey(new Date())

function prevMonth() {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() - 1, 1)
}
function nextMonth() {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 1)
}
function goToday() {
  const n = new Date()
  cursor.value = new Date(n.getFullYear(), n.getMonth(), 1)
}

const PRIORITY_DOT: Record<string, string> = {
  low: 'var(--tf-color-priority-low)',
  medium: 'var(--tf-color-priority-medium)',
  high: 'var(--tf-color-priority-high)',
  critical: 'var(--tf-color-priority-critical)'
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <h1 class="text-2xl font-bold text-text">{{ t('nav.calendar') }}</h1>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-muted hover:text-text"
          @click="goToday"
        >
          {{ t('calendar.today') }}
        </button>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-lg border border-border text-text-muted hover:text-text"
            aria-label="previous month"
            @click="prevMonth"
          >
            &lsaquo;
          </button>
          <span class="w-40 text-center text-sm font-semibold text-text">{{ monthLabel }}</span>
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-lg border border-border text-text-muted hover:text-text"
            aria-label="next month"
            @click="nextMonth"
          >
            &rsaquo;
          </button>
        </div>
      </div>
    </div>

    <div class="mt-6 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
      <div class="grid grid-cols-7 border-b border-border bg-surface-alt">
        <div
          v-for="wd in weekdays"
          :key="wd"
          class="px-2 py-2 text-center text-xs font-semibold uppercase tracking-wide text-text-muted"
        >
          {{ wd }}
        </div>
      </div>

      <div class="grid grid-cols-7">
        <div
          v-for="(cell, i) in cells"
          :key="i"
          class="min-h-28 border-b border-r border-border p-2 transition [&:nth-child(7n)]:border-r-0"
          :class="[
            cell ? 'hover:bg-surface-alt/40' : 'bg-surface-alt/30',
            cell && (i % 7 === 0 || i % 7 === 6) ? 'bg-surface-alt/20' : '',
            cell && dayKey(cell) === todayKey ? 'bg-primary/5' : ''
          ]"
        >
          <template v-if="cell">
            <div
              class="mb-1.5 flex h-6 w-6 items-center justify-center rounded-full text-xs font-semibold"
              :class="
                dayKey(cell) === todayKey
                  ? 'bg-primary text-primary-fg shadow-sm'
                  : 'text-text-muted'
              "
            >
              {{ cell.getDate() }}
            </div>
            <div class="flex flex-col gap-1">
              <NuxtLink
                v-for="tk in (tasksByDay[dayKey(cell)] ?? []).slice(0, 3)"
                :key="tk.id"
                :to="`/tasks/${tk.id}`"
                class="flex items-center gap-1.5 truncate rounded-md border-l-2 bg-surface-alt px-1.5 py-1 text-xs font-medium transition hover:shadow-sm"
                :style="`border-color:${PRIORITY_DOT[tk.priority]}`"
                :class="tk.status === 'done' ? 'text-text-muted line-through' : 'text-text'"
              >
                <span class="truncate">{{ tk.title }}</span>
              </NuxtLink>
              <span
                v-if="(tasksByDay[dayKey(cell)] ?? []).length > 3"
                class="px-1 text-xs font-medium text-text-muted"
              >
                +{{ (tasksByDay[dayKey(cell)] ?? []).length - 3 }}
              </span>
            </div>
          </template>
        </div>
      </div>
    </div>
  </div>
</template>
