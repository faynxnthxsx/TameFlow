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
  project: { name: string | null } | null
}

const { data, refresh } = await useAsyncData(
  'calendar-data',
  async () => {
    const [tasksRes, projectsRes] = await Promise.all([
      supabase
        .from('tasks')
        .select('id, title, priority, status, due_date, project:projects (name)')
        .not('due_date', 'is', null)
        .order('due_date', { ascending: true }),
      supabase
        .from('projects')
        .select('id, name')
        .order('name', { ascending: true })
    ])
    return {
      tasks: (tasksRes.data ?? []) as CalTask[],
      projects: projectsRes.data ?? []
    }
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
    if (!tk.due_date) continue
    const key = tk.due_date.split('T')[0]
    ;(map[key] ??= []).push(tk)
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

const now = new Date()
const todayKey = dayKey(now)
const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate())

// Days-from-today for a due_date string (negative = past).
function daysUntil(due: string) {
  if (!due) return 0
  const datePart = due.split('T')[0]
  const [y, m, d] = datePart.split('-').map(Number)
  return Math.round((new Date(y, m - 1, d).getTime() - startOfToday.getTime()) / 86_400_000)
}

const openTasks = computed(() =>
  (data.value?.tasks ?? []).filter((tk) => tk.status !== 'done')
)

const summary = computed(() => {
  let overdue = 0
  let dueToday = 0
  let thisWeek = 0
  for (const tk of openTasks.value) {
    const diff = daysUntil(tk.due_date)
    if (diff < 0) overdue++
    else if (diff === 0) dueToday++
    if (diff >= 0 && diff <= 7) thisWeek++
  }
  return { overdue, dueToday, thisWeek }
})

const statCards = computed(() => [
  { key: 'overdue', label: t('calendar.overdue'), value: summary.value.overdue, icon: 'clock', tint: 'bg-danger/10 text-danger' },
  { key: 'dueToday', label: t('calendar.dueToday'), value: summary.value.dueToday, icon: 'calendar', tint: 'bg-primary/10 text-primary' },
  { key: 'thisWeek', label: t('calendar.thisWeek'), value: summary.value.thisWeek, icon: 'activity', tint: 'bg-warning/10 text-warning' }
])

// Nearest open deadlines first (overdue ones bubble to the top since earliest).
const upcoming = computed(() =>
  [...openTasks.value].sort((a, b) => a.due_date.localeCompare(b.due_date)).slice(0, 8)
)

function prevMonth() {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() - 1, 1)
}
function nextMonth() {
  cursor.value = new Date(cursor.value.getFullYear(), cursor.value.getMonth() + 1, 1)
}
function goToday() {
  cursor.value = new Date(now.getFullYear(), now.getMonth(), 1)
}
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value, { day: 'numeric', month: 'short' })
}

const PRIORITY_DOT: Record<string, string> = {
  low: 'var(--tf-color-priority-low)',
  medium: 'var(--tf-color-priority-medium)',
  high: 'var(--tf-color-priority-high)',
  critical: 'var(--tf-color-priority-critical)'
}

// --- task creation ---
const showForm = ref(false)
const titleInput = ref<HTMLInputElement | null>(null)
const newTitle = ref('')
const newProjectId = ref('')
const newDueDate = ref('')
const creating = ref(false)
const errorMsg = ref('')

const projectOptions = computed(() =>
  (data.value?.projects ?? []).map((p) => ({ value: p.id, label: p.name }))
)

function openCreateForm(date: Date) {
  if (!data.value?.projects?.length) {
    alert(t('error.generic') || 'No projects available.')
    return
  }
  newDueDate.value = dayKey(date)
  newProjectId.value = projectOptions.value[0]?.value ?? ''
  newTitle.value = ''
  errorMsg.value = ''
  showForm.value = true
  nextTick(() => titleInput.value?.focus())
}

function cancelForm() {
  showForm.value = false
  newTitle.value = ''
  errorMsg.value = ''
}

async function createTask() {
  const title = newTitle.value.trim()
  if (!title || !newProjectId.value) return
  creating.value = true
  errorMsg.value = ''
  const { data: auth } = await supabase.auth.getUser()
  const myUserId = auth.user?.id
  const { error: insertError } = await supabase.from('tasks').insert({
    project_id: newProjectId.value,
    title,
    priority: 'medium',
    type: 'other',
    due_date: newDueDate.value || null,
    created_by: myUserId
  })
  creating.value = false
  if (insertError) {
    errorMsg.value = t('error.generic')
    return
  }
  cancelForm()
  await refresh()
}

const taskModal = useTaskModal()
watch(taskModal.refreshTrigger, () => refresh())
</script>

<template>
  <div class="mx-auto max-w-7xl">
    <div class="flex flex-wrap items-center justify-between gap-3">
      <div>
        <h1 class="text-2xl font-bold text-text">{{ t('nav.calendar') }}</h1>
        <p class="mt-1 text-sm text-text-muted">{{ t('calendar.subtitle') }}</p>
      </div>
      <div class="flex items-center gap-2">
        <button
          type="button"
          class="rounded-lg border border-border px-3 py-1.5 text-sm font-medium text-text-muted transition hover:text-text"
          @click="goToday"
        >
          {{ t('calendar.today') }}
        </button>
        <div class="flex items-center gap-1">
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-lg border border-border text-text-muted transition hover:text-text"
            aria-label="previous month"
            @click="prevMonth"
          >
            <AppIcon name="chevron-left" class="h-4 w-4" />
          </button>
          <span class="w-40 text-center text-sm font-semibold text-text">{{ monthLabel }}</span>
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-lg border border-border text-text-muted transition hover:text-text"
            aria-label="next month"
            @click="nextMonth"
          >
            <AppIcon name="chevron-right" class="h-4 w-4" />
          </button>
        </div>
      </div>
    </div>

    <div class="mt-6 grid gap-6 lg:grid-cols-3">
      <!-- Calendar -->
      <div class="overflow-hidden rounded-2xl border border-border bg-surface shadow-card lg:col-span-2">
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
            class="min-h-24 border-b border-r border-border p-2 transition [&:nth-child(7n)]:border-r-0"
            :class="[
              cell ? 'cursor-pointer hover:bg-surface-alt/40' : 'bg-surface-alt/30',
              cell && (i % 7 === 0 || i % 7 === 6) ? 'bg-surface-alt/20' : '',
              cell && dayKey(cell) === todayKey ? 'bg-primary/5' : ''
            ]"
            @click="cell ? openCreateForm(cell) : undefined"
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
                <button type="button"
                  v-for="tk in (tasksByDay[dayKey(cell)] ?? []).slice(0, 3)"
                  :key="tk.id"
                  @click.stop="taskModal.open(tk.id)"
                  class="flex items-center gap-1.5 truncate rounded-md border-l-2 bg-surface-alt px-1.5 py-1 text-xs font-medium transition hover:shadow-sm"
                  :style="`border-color:${PRIORITY_DOT[tk.priority]}`"
                  :class="tk.status === 'done' ? 'text-text-muted line-through' : 'text-text'"
                >
                  <span class="truncate">{{ tk.title }}</span>
                </button>
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

      <!-- Side rail -->
      <div class="flex flex-col gap-4">
        <!-- Summary -->
        <div class="grid grid-cols-3 gap-3">
          <div
            v-for="card in statCards"
            :key="card.key"
            class="rounded-2xl border border-border bg-surface p-3 shadow-card"
          >
            <span class="grid h-8 w-8 place-items-center rounded-lg" :class="card.tint">
              <AppIcon :name="card.icon" class="h-4 w-4" />
            </span>
            <p class="mt-2 text-xl font-bold text-text">{{ card.value }}</p>
            <p class="text-xs leading-tight text-text-muted">{{ card.label }}</p>
          </div>
        </div>

        <!-- Upcoming deadlines -->
        <div class="rounded-2xl border border-border bg-surface p-4 shadow-card">
          <h2 class="text-sm font-semibold text-text">{{ t('calendar.upcoming') }}</h2>

          <p v-if="upcoming.length === 0" class="mt-4 flex flex-col items-center gap-2 py-4 text-center text-sm text-text-muted">
            <AppIcon name="calendar" class="h-6 w-6 text-text-muted/50" />
            {{ t('calendar.noUpcoming') }}
          </p>

          <ul v-else class="mt-3 flex flex-col gap-1">
            <button type="button"
              v-for="tk in upcoming"
              :key="tk.id"
              @click.stop="taskModal.open(tk.id)"
              class="flex items-center gap-2.5 rounded-xl px-2 py-2 transition hover:bg-surface-alt"
            >
              <span
                class="h-2.5 w-2.5 shrink-0 rounded-full"
                :style="`background:${PRIORITY_DOT[tk.priority]}`"
              />
              <div class="min-w-0 flex-1">
                <p class="truncate text-sm font-medium text-text">{{ tk.title }}</p>
                <p class="truncate text-xs text-text-muted">{{ tk.project?.name }}</p>
              </div>
              <span
                class="shrink-0 text-xs font-medium"
                :class="daysUntil(tk.due_date) < 0 ? 'text-danger' : 'text-text-muted'"
              >
                {{ formatDate(tk.due_date) }}
              </span>
            </button>
          </ul>
        </div>

        <!-- Priority legend -->
        <div class="rounded-2xl border border-border bg-surface p-4 shadow-card">
          <h2 class="text-sm font-semibold text-text">{{ t('calendar.legend') }}</h2>
          <div class="mt-3 flex flex-wrap gap-x-4 gap-y-2">
            <span
              v-for="p in TASK_PRIORITIES"
              :key="p"
              class="flex items-center gap-1.5 text-xs text-text-muted"
            >
              <span class="h-2.5 w-2.5 rounded-full" :style="`background:${PRIORITY_DOT[p]}`" />
              {{ t(`taskPriority.${p}`) }}
            </span>
          </div>
        </div>
      </div>
    </div>

    <!-- Create task modal -->
    <Teleport to="body">
      <div v-if="showForm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-text/50 backdrop-blur-sm" @click="cancelForm" />
        <div class="relative w-full max-w-sm rounded-2xl bg-surface p-6 shadow-modal">
          <div class="flex items-start justify-between gap-4">
            <h2 class="text-lg font-bold text-text">{{ t('task.create') }}</h2>
            <button
              type="button"
              class="rounded-lg p-1 text-text-muted transition hover:bg-surface-alt hover:text-text"
              @click="cancelForm"
            >
              <AppIcon name="x" class="h-5 w-5" />
            </button>
          </div>
          <form class="mt-4 flex flex-col gap-4" @submit.prevent="createTask">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-text">{{ t('task.titlePlaceholder') }}</label>
              <input
                ref="titleInput"
                v-model="newTitle"
                type="text"
                maxlength="200"
                required
                class="w-full rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                @keyup.esc="cancelForm"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-text">{{ t('nav.projects') }}</label>
              <AppSelect
                v-model="newProjectId"
                :options="projectOptions"
                required
              />
            </div>
            <p v-if="errorMsg" class="text-sm text-danger">{{ errorMsg }}</p>
            <div class="mt-2 flex justify-end gap-3">
              <button
                type="button"
                class="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted transition hover:text-text"
                @click="cancelForm"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="submit"
                :disabled="creating || !newTitle.trim() || !newProjectId"
                class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover disabled:opacity-60"
              >
                <AppIcon name="plus" class="h-4 w-4" />
                {{ creating ? t('common.loading') : t('task.create') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
