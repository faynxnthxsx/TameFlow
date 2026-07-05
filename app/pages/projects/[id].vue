<script setup lang="ts">
import type { DueStatus } from '~/utils/dates'
import type { WorkspaceRole } from '~/utils/permissions'
import type { TaskPriority, TaskStatus } from '~/utils/tasks'

const route = useRoute()
const { t, locale } = useI18n()
const supabase = useSupabaseClient()

const projectId = route.params.id as string

interface BoardTask {
  id: string
  title: string
  status: TaskStatus
  priority: string
  due_date: string | null
  created_by: string | null
  assignee: { display_name: string | null; avatar_url: string | null } | null
}

const { data, pending, error, refresh } = await useAsyncData(
  `project-${projectId}`,
  async () => {
    const projectRes = await supabase
      .from('projects')
      .select('id, name, description, workspace_id, workspace:workspaces (name)')
      .eq('id', projectId)
      .single()
    if (projectRes.error) throw projectRes.error
    const project = projectRes.data

    const [tasksRes, membersRes, roleRes, authRes] = await Promise.all([
      supabase
        .from('tasks')
        .select(
          'id, title, status, priority, due_date, created_by, assignee:user_profiles!tasks_assignee_id_fkey (display_name, avatar_url)'
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
      supabase
        .from('workspace_members')
        .select('user_id, profile:user_profiles (display_name)')
        .eq('workspace_id', project.workspace_id),
      supabase.rpc('workspace_role', { ws_id: project.workspace_id }),
      supabase.auth.getUser()
    ])
    if (tasksRes.error) throw tasksRes.error
    if (membersRes.error) throw membersRes.error
    if (roleRes.error) throw roleRes.error

    const tasks: BoardTask[] = (tasksRes.data ?? []).map((row) => ({
      ...row,
      status: isTaskStatus(row.status) ? row.status : 'todo'
    }))
    return {
      project,
      tasks,
      members: membersRes.data ?? [],
      role: (roleRes.data ?? null) as WorkspaceRole | null,
      myUserId: authRes.data.user?.id ?? null
    }
  },
  { lazy: true }
)

const capabilities = computed(() =>
  data.value?.role ? resolveCapabilities(data.value.role) : null
)
const columns = computed(() => groupTasksByStatus(data.value?.tasks ?? []))

// --- create form ---
const showForm = ref(false)
const titleInput = ref<HTMLInputElement | null>(null)
const newTitle = ref('')
const newPriority = ref<TaskPriority>('medium')
const newDueDate = ref('')
const newAssignee = ref('')
const creating = ref(false)
const errorMsg = ref('')

function openForm() {
  showForm.value = true
  nextTick(() => titleInput.value?.focus())
}

function cancelForm() {
  showForm.value = false
  newTitle.value = ''
  newPriority.value = 'medium'
  newDueDate.value = ''
  newAssignee.value = ''
  errorMsg.value = ''
}

async function createTask() {
  const title = newTitle.value.trim()
  if (!title) return
  creating.value = true
  errorMsg.value = ''
  const { error: insertError } = await supabase.from('tasks').insert({
    project_id: projectId,
    title,
    priority: newPriority.value,
    due_date: newDueDate.value || null,
    assignee_id: newAssignee.value || null,
    created_by: data.value?.myUserId
  })
  creating.value = false
  if (insertError) {
    errorMsg.value = t('error.generic')
    return
  }
  cancelForm()
  await refresh()
}

// --- card actions ---
function canMove(task: BoardTask) {
  if (!data.value?.role) return false
  return canEditTask(data.value.role, task.created_by === data.value.myUserId)
}

async function moveTask(task: BoardTask, status: TaskStatus) {
  errorMsg.value = ''
  const { error: updateError } = await supabase
    .from('tasks')
    .update({ status })
    .eq('id', task.id)
  if (updateError) {
    errorMsg.value = t('error.generic')
    return
  }
  await refresh()
}

async function deleteTask(task: BoardTask) {
  if (!window.confirm(t('task.deleteConfirm', { title: task.title }))) return
  errorMsg.value = ''
  const { error: deleteError } = await supabase
    .from('tasks')
    .delete()
    .eq('id', task.id)
  if (deleteError) {
    errorMsg.value = t('error.generic')
    return
  }
  await refresh()
}

// --- display helpers ---
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value)
}

const DUE_CLASSES: Record<DueStatus, string> = {
  overdue: 'text-danger font-medium',
  'due-soon': 'text-warning font-medium',
  upcoming: 'text-text-muted',
  none: 'text-text-muted'
}

const PRIORITY_BADGE_CLASSES: Record<string, string> = {
  low: 'border-priority-low text-priority-low',
  medium: 'border-priority-medium text-priority-medium',
  high: 'border-priority-high text-priority-high',
  critical: 'border-priority-critical text-priority-critical'
}

const STATUS_DOT: Record<TaskStatus, string> = {
  todo: 'var(--tf-color-text-muted)',
  in_progress: 'var(--tf-color-primary)',
  done: 'var(--tf-color-success)'
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <p v-if="pending" class="text-text-muted">{{ t('common.loading') }}</p>

    <template v-else-if="error || !data">
      <p class="rounded-2xl border border-border bg-surface p-8 text-center text-text-muted">
        {{ t('error.notFound') }}
      </p>
      <NuxtLink to="/workspaces" class="mt-4 block text-center text-sm font-medium text-primary hover:underline">
        {{ t('common.back') }}
      </NuxtLink>
    </template>

    <template v-else>
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <NuxtLink
            :to="`/workspaces/${data.project.workspace_id}`"
            class="text-sm text-text-muted hover:text-text"
          >
            &larr; {{ data.project.workspace?.name ?? t('nav.workspaces') }}
          </NuxtLink>
          <h1 class="mt-1 text-2xl font-bold text-text">{{ data.project.name }}</h1>
          <p v-if="data.project.description" class="mt-1 max-w-xl text-sm text-text-muted">
            {{ data.project.description }}
          </p>
        </div>
        <button
          v-if="capabilities?.createTask && !showForm"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover"
          @click="openForm"
        >
          <AppIcon name="plus" class="h-4 w-4" />
          {{ t('task.create') }}
        </button>
      </div>

      <form
        v-if="showForm"
        class="mt-4 grid gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card sm:grid-cols-2 lg:grid-cols-4"
        @submit.prevent="createTask"
      >
        <input
          ref="titleInput"
          v-model="newTitle"
          type="text"
          maxlength="200"
          :placeholder="t('task.titlePlaceholder')"
          class="rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 sm:col-span-2 lg:col-span-4"
        />
        <label class="flex flex-col gap-1 text-sm text-text-muted">
          {{ t('task.priority') }}
          <select
            v-model="newPriority"
            class="rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option v-for="p in TASK_PRIORITIES" :key="p" :value="p">
              {{ t(`taskPriority.${p}`) }}
            </option>
          </select>
        </label>
        <label class="flex flex-col gap-1 text-sm text-text-muted">
          {{ t('task.dueDate') }}
          <input
            v-model="newDueDate"
            type="date"
            class="rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>
        <label class="flex flex-col gap-1 text-sm text-text-muted">
          {{ t('task.assignee') }}
          <select
            v-model="newAssignee"
            class="rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option value="">{{ t('task.unassigned') }}</option>
            <option v-for="m in data.members" :key="m.user_id" :value="m.user_id">
              {{ m.profile?.display_name ?? '—' }}
            </option>
          </select>
        </label>
        <div class="flex items-end gap-2">
          <button
            type="submit"
            :disabled="creating || !newTitle.trim()"
            class="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-60"
          >
            {{ creating ? t('common.loading') : t('task.create') }}
          </button>
          <button
            type="button"
            class="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted hover:text-text"
            @click="cancelForm"
          >
            {{ t('common.cancel') }}
          </button>
        </div>
      </form>
      <p v-if="errorMsg" class="mt-2 text-sm text-danger">{{ errorMsg }}</p>

      <div class="mt-6 grid gap-4 md:grid-cols-3">
        <section
          v-for="status in TASK_STATUSES"
          :key="status"
          class="rounded-2xl bg-surface-alt p-3"
        >
          <h2 class="flex items-center gap-2 px-1 text-sm font-semibold uppercase tracking-wide text-text-muted">
            <span class="h-2.5 w-2.5 rounded-full" :style="`background:${STATUS_DOT[status]}`" />
            {{ t(`taskStatus.${status}`) }}
            <span class="ml-auto rounded-full bg-surface px-2 py-0.5 text-xs font-medium text-text-muted">
              {{ columns[status].length }}
            </span>
          </h2>

          <p v-if="columns[status].length === 0" class="mt-3 px-1 text-sm text-text-muted">
            {{ t('task.emptyColumn') }}
          </p>

          <div v-else class="mt-3 flex flex-col gap-2">
            <article
              v-for="task in columns[status]"
              :key="task.id"
              class="rounded-xl border border-border bg-surface p-3 shadow-card transition hover:shadow-md"
            >
              <div class="flex items-start justify-between gap-2">
                <NuxtLink
                  :to="`/tasks/${task.id}`"
                  class="font-medium text-text hover:text-primary hover:underline"
                >
                  {{ task.title }}
                </NuxtLink>
                <button
                  v-if="capabilities?.deleteTask"
                  type="button"
                  class="text-text-muted hover:text-danger"
                  :aria-label="t('common.delete')"
                  @click="deleteTask(task)"
                >
                  &#10005;
                </button>
              </div>

              <div class="mt-2 flex flex-wrap items-center gap-2 text-xs">
                <span
                  class="rounded-full border px-2 py-0.5 font-medium"
                  :class="PRIORITY_BADGE_CLASSES[task.priority]"
                >
                  {{ t(`taskPriority.${task.priority}`) }}
                </span>
                <span
                  v-if="task.due_date"
                  :class="DUE_CLASSES[getDueStatus(task.due_date, new Date(), task.status === 'done')]"
                >
                  {{ formatDate(task.due_date) }}
                </span>
                <span v-if="task.assignee" class="text-text-muted">
                  {{ task.assignee.display_name ?? '—' }}
                </span>
              </div>

              <div v-if="canMove(task)" class="mt-2 flex justify-between">
                <button
                  v-if="prevStatus(task.status)"
                  type="button"
                  class="rounded px-2 py-0.5 text-xs text-text-muted hover:bg-surface-alt hover:text-text"
                  @click="moveTask(task, prevStatus(task.status)!)"
                >
                  &larr; {{ t(`taskStatus.${prevStatus(task.status)}`) }}
                </button>
                <span v-else />
                <button
                  v-if="nextStatus(task.status)"
                  type="button"
                  class="rounded px-2 py-0.5 text-xs text-text-muted hover:bg-surface-alt hover:text-text"
                  @click="moveTask(task, nextStatus(task.status)!)"
                >
                  {{ t(`taskStatus.${nextStatus(task.status)}`) }} &rarr;
                </button>
              </div>
            </article>
          </div>
        </section>
      </div>
    </template>
  </div>
</template>
