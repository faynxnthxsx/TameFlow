<script setup lang="ts">
import type { DueStatus } from '~/utils/dates'
import type { WorkspaceRole } from '~/utils/permissions'
import type { TaskPriority, TaskStatus } from '~/utils/tasks'

const props = defineProps<{ taskId: string }>()
const emit = defineEmits<{ (e: 'close'): void }>()

const { t, locale } = useI18n()
const supabase = useSupabaseClient()

const { data, pending, error, refresh } = await useAsyncData(
  `task-${props.taskId}`,
  async () => {
    const taskRes = await supabase
      .from('tasks')
      .select(
        'id, title, description, status, priority, due_date, assignee_id, created_by, created_at, project_id, workspace_id, project:projects (name), assignee:user_profiles!tasks_assignee_id_fkey (display_name, avatar_url), creator:user_profiles!tasks_created_by_fkey (display_name)'
      )
      .eq('id', props.taskId)
      .single()
    if (taskRes.error) throw taskRes.error
    const task = taskRes.data

    const [membersRes, roleRes, checklistRes, commentsRes, authRes] = await Promise.all([
      supabase
        .from('workspace_members')
        .select('user_id, profile:user_profiles (display_name)')
        .eq('workspace_id', task.workspace_id),
      supabase.rpc('workspace_role', { ws_id: task.workspace_id }),
      supabase
        .from('task_checklist_items')
        .select('id, content, is_done, created_at')
        .eq('task_id', props.taskId)
        .order('created_at', { ascending: true }),
      supabase
        .from('task_comments')
        .select(
          'id, body, created_at, author_id, author:user_profiles!task_comments_author_id_fkey (display_name, avatar_url)'
        )
        .eq('task_id', props.taskId)
        .order('created_at', { ascending: true }),
      supabase.auth.getUser()
    ])
    if (membersRes.error) throw membersRes.error
    if (roleRes.error) throw roleRes.error
    if (checklistRes.error) throw checklistRes.error
    if (commentsRes.error) throw commentsRes.error

    return {
      task: {
        ...task,
        status: isTaskStatus(task.status) ? task.status : 'todo'
      },
      members: membersRes.data ?? [],
      role: (roleRes.data ?? null) as WorkspaceRole | null,
      checklist: checklistRes.data ?? [],
      comments: commentsRes.data ?? [],
      myUserId: authRes.data.user?.id ?? null
    }
  },
  { lazy: true }
)

const capabilities = computed(() =>
  data.value?.role ? resolveCapabilities(data.value.role) : null
)

// Whether the current user may edit this task (managers edit any, members
// their own) — mirrors the tasks UPDATE RLS policy.
const canEdit = computed(() => {
  const d = data.value
  if (!d?.role) return false
  return canEditTask(d.role, d.task.created_by === d.myUserId)
})

// --- checklist ---
const checklistPct = computed(() =>
  checklistCompletionPct(data.value?.checklist ?? [])
)
const checklistDone = computed(
  () => (data.value?.checklist ?? []).filter((item) => item.is_done).length
)

const newItem = ref('')
const addingItem = ref(false)

async function addItem() {
  const content = newItem.value.trim()
  if (!content) return
  addingItem.value = true
  errorMsg.value = ''
  const { error: insertError } = await supabase
    .from('task_checklist_items')
    .insert({ task_id: props.taskId, content })
  addingItem.value = false
  if (insertError) {
    errorMsg.value = t('error.generic')
    return
  }
  newItem.value = ''
  await refresh()
}

async function toggleItem(item: { id: string; is_done: boolean }) {
  const next = !item.is_done
  item.is_done = next // optimistic
  const { error: updateError } = await supabase
    .from('task_checklist_items')
    .update({ is_done: next })
    .eq('id', item.id)
  if (updateError) {
    item.is_done = !next // revert
    errorMsg.value = t('error.generic')
  }
}

async function deleteItem(item: { id: string }) {
  const { error: deleteError } = await supabase
    .from('task_checklist_items')
    .delete()
    .eq('id', item.id)
  if (deleteError) {
    errorMsg.value = t('error.generic')
    return
  }
  await refresh()
}

// --- comments ---
// Contributors (owner/admin/member) can comment; viewers cannot.
const canComment = computed(() => capabilities.value?.createTask ?? false)
const newComment = ref('')
const posting = ref(false)

function canDeleteComment(c: { author_id: string }) {
  return c.author_id === data.value?.myUserId || (capabilities.value?.deleteTask ?? false)
}

async function addComment() {
  const body = newComment.value.trim()
  if (!body) return
  posting.value = true
  errorMsg.value = ''
  const { error: insertError } = await supabase
    .from('task_comments')
    .insert({ task_id: props.taskId, author_id: data.value?.myUserId, body })
  posting.value = false
  if (insertError) {
    errorMsg.value = t('error.generic')
    return
  }
  newComment.value = ''
  await refresh()
}

async function deleteComment(id: string) {
  const { error: deleteError } = await supabase.from('task_comments').delete().eq('id', id)
  if (deleteError) {
    errorMsg.value = t('error.generic')
    return
  }
  await refresh()
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

// --- edit form ---
const editTitle = ref('')
const editDescription = ref('')
const editStatus = ref<TaskStatus>('todo')
const editPriority = ref<TaskPriority>('medium')
const editDueDate = ref('')
const editAssignee = ref('')
const saving = ref(false)
const errorMsg = ref('')

// Initialize edit state when data loads
watch(
  () => data.value?.task,
  (task) => {
    if (task) {
      editTitle.value = task.title
      editDescription.value = task.description || ''
      editStatus.value = task.status
      editPriority.value = isTaskPriority(task.priority) ? task.priority : 'medium'
      editDueDate.value = task.due_date ?? ''
      editAssignee.value = task.assignee_id ?? ''
    }
  },
  { immediate: true }
)

const isDirty = computed(() => {
  const task = data.value?.task
  if (!task) return false
  return (
    editTitle.value !== task.title ||
    editDescription.value !== (task.description || '') ||
    editStatus.value !== task.status ||
    editPriority.value !== (isTaskPriority(task.priority) ? task.priority : 'medium') ||
    editDueDate.value !== (task.due_date ?? '') ||
    editAssignee.value !== (task.assignee_id ?? '')
  )
})

async function saveTask() {
  const title = editTitle.value.trim()
  if (!title) return
  saving.value = true
  errorMsg.value = ''
  const { error: updateError } = await supabase
    .from('tasks')
    .update({
      title,
      description: editDescription.value.trim(),
      status: editStatus.value,
      priority: editPriority.value,
      due_date: editDueDate.value || null,
      assignee_id: editAssignee.value || null
    })
    .eq('id', props.taskId)
  saving.value = false
  if (updateError) {
    errorMsg.value = t('error.generic')
    return
  }
  await refresh()
}

async function deleteTask() {
  const task = data.value?.task
  if (!task) return
  if (!window.confirm(t('task.deleteConfirm', { title: task.title }))) return
  errorMsg.value = ''
  const { error: deleteError } = await supabase
    .from('tasks')
    .delete()
    .eq('id', props.taskId)
  if (deleteError) {
    errorMsg.value = t('error.generic')
    return
  }
  emit('close')
}

// --- display helpers ---
function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value)
}

const DUE_CLASSES: Record<DueStatus, string> = {
  overdue: 'text-danger font-medium',
  'due-soon': 'text-warning font-medium',
  upcoming: 'text-text',
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
  <div class="mx-auto max-w-3xl">
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
      <button
        type="button"
        class="text-sm text-text-muted hover:text-text"
        @click="$emit('close')"
      >
        &larr; {{ t('common.close') }}
      </button>

      <form
        class="mt-2 flex flex-col gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card"
        @submit.prevent="saveTask"
      >
        <div class="flex items-start justify-between gap-3">
          <label class="flex-1 flex flex-col gap-1 text-sm text-text-muted">
            {{ t('task.titlePlaceholder') }}
            <input
              v-model="editTitle"
              type="text"
              maxlength="200"
              :disabled="!canEdit"
              class="text-xl font-bold rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-80 disabled:bg-surface-alt"
            />
          </label>
          <button
            v-if="capabilities?.deleteTask"
            type="button"
            class="mt-6 rounded-xl border border-border px-3 py-2 text-sm font-medium text-text-muted transition hover:border-danger hover:text-danger shrink-0"
            @click="deleteTask"
          >
            <AppIcon name="trash" class="h-4 w-4 inline-block mr-1" />
            {{ t('common.delete') }}
          </button>
        </div>

        <label class="flex flex-col gap-1 text-sm text-text-muted">
          {{ t('task.description') }}
          <textarea
            v-model="editDescription"
            rows="4"
            maxlength="2000"
            :disabled="!canEdit"
            :placeholder="t('task.descriptionPlaceholder')"
            class="resize-y rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-80 disabled:bg-surface-alt"
          />
        </label>

        <div class="grid gap-4 sm:grid-cols-2">
          <label class="flex flex-col gap-1 text-sm text-text-muted">
            {{ t('task.status') }}
            <select
              v-model="editStatus"
              :disabled="!canEdit"
              class="rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-80 disabled:bg-surface-alt"
            >
              <option v-for="s in TASK_STATUSES" :key="s" :value="s">
                {{ t(`taskStatus.${s}`) }}
              </option>
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm text-text-muted">
            {{ t('task.priority') }}
            <select
              v-model="editPriority"
              :disabled="!canEdit"
              class="rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-80 disabled:bg-surface-alt"
            >
              <option v-for="p in TASK_PRIORITIES" :key="p" :value="p">
                {{ t(`taskPriority.${p}`) }}
              </option>
            </select>
          </label>
          <label class="flex flex-col gap-1 text-sm text-text-muted">
            {{ t('task.dueDate') }}
            <input
              v-model="editDueDate"
              type="date"
              :disabled="!canEdit"
              class="rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-80 disabled:bg-surface-alt"
            />
          </label>
          <label class="flex flex-col gap-1 text-sm text-text-muted">
            {{ t('task.assignee') }}
            <select
              v-model="editAssignee"
              :disabled="!canEdit"
              class="rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20 disabled:opacity-80 disabled:bg-surface-alt"
            >
              <option value="">{{ t('task.unassigned') }}</option>
              <option v-for="m in data.members" :key="m.user_id" :value="m.user_id">
                {{ m.profile?.display_name ?? '—' }}
              </option>
            </select>
          </label>
        </div>
        
        <div class="flex justify-between items-end mt-2">
          <div class="text-sm text-text-muted">
            {{ t('task.createdBy') }}: {{ data.task.creator?.display_name ?? '—' }} · {{ formatDate(data.task.created_at) }}
          </div>
          <div v-if="canEdit" class="flex gap-3">
            <button
              type="submit"
              :disabled="saving || !editTitle.trim() || !isDirty"
              class="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-60 transition"
            >
              {{ saving ? t('common.loading') : (isDirty ? t('common.save') : t('common.save')) }}
            </button>
          </div>
        </div>
      </form>

      <!-- checklist -->
      <section class="mt-4 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <div class="flex items-center justify-between gap-3">
          <h2 class="text-sm font-semibold uppercase tracking-wide text-text-muted">
            {{ t('task.checklistTitle') }}
          </h2>
          <span
            v-if="data.checklist.length"
            class="text-xs font-medium text-text-muted"
          >
            {{ checklistDone }}/{{ data.checklist.length }} · {{ checklistPct }}%
          </span>
        </div>

        <div
          v-if="data.checklist.length"
          class="mt-3 h-2 overflow-hidden rounded-full bg-surface-alt"
        >
          <div
            class="h-full rounded-full bg-primary transition-all"
            :style="`width:${checklistPct}%`"
          />
        </div>

        <ul v-if="data.checklist.length" class="mt-4 flex flex-col gap-1">
          <li
            v-for="item in data.checklist"
            :key="item.id"
            class="group flex items-center gap-3 rounded-lg px-2 py-1.5 hover:bg-surface-alt"
          >
            <input
              type="checkbox"
              :checked="item.is_done"
              :disabled="!canEdit"
              class="h-4 w-4 shrink-0 rounded border-border text-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              @change="toggleItem(item)"
            />
            <span
              class="flex-1 text-sm"
              :class="item.is_done ? 'text-text-muted line-through' : 'text-text'"
            >
              {{ item.content }}
            </span>
            <button
              v-if="canEdit"
              type="button"
              class="text-text-muted opacity-0 transition hover:text-danger group-hover:opacity-100"
              :aria-label="t('common.delete')"
              @click="deleteItem(item)"
            >
              &#10005;
            </button>
          </li>
        </ul>
        <p v-else class="mt-3 text-sm text-text-muted">{{ t('task.checklistEmpty') }}</p>

        <form v-if="canEdit" class="mt-4 flex gap-2" @submit.prevent="addItem">
          <input
            v-model="newItem"
            type="text"
            maxlength="200"
            :placeholder="t('task.checklistPlaceholder')"
            class="flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            :disabled="addingItem || !newItem.trim()"
            class="inline-flex items-center rounded-xl bg-primary px-3 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-60"
          >
            <AppIcon name="plus" class="h-4 w-4" />
          </button>
        </form>
      </section>

      <!-- comments -->
      <section class="mt-4 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <h2 class="text-sm font-semibold uppercase tracking-wide text-text-muted">
          {{ t('task.comments') }}
          <span v-if="data.comments.length" class="text-text-muted">({{ data.comments.length }})</span>
        </h2>

        <ul v-if="data.comments.length" class="mt-4 space-y-4">
          <li v-for="c in data.comments" :key="c.id" class="flex gap-3">
            <img
              v-if="c.author?.avatar_url"
              :src="c.author.avatar_url"
              alt=""
              class="h-8 w-8 shrink-0 rounded-full object-cover"
            />
            <div
              v-else
              class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-surface-alt text-xs font-medium text-text-muted"
            >
              {{ (c.author?.display_name ?? '?').charAt(0).toUpperCase() }}
            </div>
            <div class="min-w-0 flex-1 rounded-xl bg-surface-alt px-3 py-2">
              <div class="flex items-center gap-2">
                <span class="text-sm font-medium text-text">{{ c.author?.display_name ?? '—' }}</span>
                <span class="text-xs text-text-muted">{{ timeAgo(c.created_at) }}</span>
                <button
                  v-if="canDeleteComment(c)"
                  type="button"
                  class="ml-auto text-text-muted transition hover:text-danger"
                  :aria-label="t('common.delete')"
                  @click="deleteComment(c.id)"
                >
                  <AppIcon name="trash" class="h-3.5 w-3.5" />
                </button>
              </div>
              <p class="mt-0.5 whitespace-pre-wrap text-sm text-text">{{ c.body }}</p>
            </div>
          </li>
        </ul>
        <p v-else class="mt-3 text-sm text-text-muted">{{ t('task.noComments') }}</p>

        <form v-if="canComment" class="mt-4 flex items-start gap-2" @submit.prevent="addComment">
          <textarea
            v-model="newComment"
            rows="2"
            maxlength="2000"
            :placeholder="t('task.commentPlaceholder')"
            class="flex-1 resize-y rounded-xl border border-border bg-surface px-3 py-2 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            :disabled="posting || !newComment.trim()"
            class="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-60"
          >
            {{ t('common.save') }}
          </button>
        </form>
      </section>

      <p v-if="errorMsg" class="mt-2 text-sm text-danger">{{ errorMsg }}</p>
    </template>
  </div>
</template>
