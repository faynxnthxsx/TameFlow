<script setup lang="ts">
import { formatDate as _formatDate } from '~/utils/dates'
import type { DueStatus } from '~/utils/dates'
import type { WorkspaceRole } from '~/utils/permissions'
import type { TaskPriority, TaskStatus, TaskType } from '~/utils/tasks'

const route = useRoute()
const { t, locale } = useI18n()
const supabase = useSupabaseClient()

const projectId = route.params.id as string

interface BoardTask {
  id: string
  title: string
  description: string | null
  status: TaskStatus
  priority: string
  type: TaskType
  due_date: string | null
  created_by: string | null
  assignee_id: string | null
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
          'id, title, description, status, priority, type, due_date, created_by, assignee_id, assignee:user_profiles!tasks_assignee_id_fkey (display_name, avatar_url)'
        )
        .eq('project_id', projectId)
        .order('created_at', { ascending: true }),
      supabase
        .from('workspace_members')
        .select('user_id, profile:user_profiles (display_name, line_user_id)')
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

// --- filters ---
const searchQuery = ref('')
const filterAssignee = ref('')
const filterPriority = ref('')
const expandedColumns = ref<Record<TaskStatus, boolean>>({ todo: false, in_progress: false, done: false })

const filteredTasks = computed(() => {
  let list = data.value?.tasks ?? []
  if (searchQuery.value) {
    const q = searchQuery.value.toLowerCase()
    list = list.filter((t) => t.title.toLowerCase().includes(q) || (t.description || '').toLowerCase().includes(q))
  }
  if (filterAssignee.value) {
    if (filterAssignee.value === 'me') {
      list = list.filter((t) => t.assignee_id === data.value?.myUserId)
    } else if (filterAssignee.value === 'unassigned') {
      list = list.filter((t) => !t.assignee_id)
    } else {
      list = list.filter((t) => t.assignee_id === filterAssignee.value)
    }
  }
  if (filterPriority.value) {
    list = list.filter((t) => t.priority === filterPriority.value)
  }
  return list
})

const columns = computed(() => groupTasksByStatus(filteredTasks.value))

// Option lists for the styled AppSelect dropdowns (re-localize with `t`).
const statusOptions = computed(() =>
  TASK_STATUSES.map((s) => ({ value: s, label: t(`taskStatus.${s}`) }))
)
const priorityOptions = computed(() =>
  TASK_PRIORITIES.map((p) => ({ value: p, label: t(`taskPriority.${p}`) }))
)
const typeOptions = computed(() =>
  TASK_TYPES.map((ty) => ({ value: ty, label: t(`taskType.${ty}`) }))
)
const assigneeOptions = computed(() => [
  { value: '', label: t('task.unassigned') },
  ...(data.value?.members ?? []).map((m) => ({
    value: m.user_id,
    label: m.profile?.display_name ?? '—'
  }))
])

const filterAssigneeOptions = computed(() => [
  { value: '', label: t('task.filterAll') || 'ทั้งหมด' },
  { value: 'me', label: t('task.filterMyTasks') || 'งานของฉัน' },
  { value: 'unassigned', label: t('task.filterUnassigned') || 'ไม่มีผู้รับผิดชอบ' },
  ...(data.value?.members ?? []).map((m) => ({
    value: m.user_id,
    label: m.profile?.display_name ?? '—'
  }))
])

const filterPriorityOptions = computed(() => [
  { value: '', label: t('task.filterAllPriorities') || 'ความสำคัญทั้งหมด' },
  ...priorityOptions.value
])

// --- create form ---
const showForm = ref(false)
const titleInput = ref<HTMLInputElement | null>(null)
const newTitle = ref('')
const newDescription = ref('')
const newPriority = ref<TaskPriority>('medium')
const newType = ref<TaskType>('other')
const newDueDate = ref('')
const newAssignee = ref('')
const newStatus = ref<TaskStatus>('todo')
const creating = ref(false)
const errorMsg = ref('')

function openForm() {
  showForm.value = true
  nextTick(() => titleInput.value?.focus())
}

function cancelForm() {
  showForm.value = false
  newTitle.value = ''
  newDescription.value = ''
  newPriority.value = 'medium'
  newType.value = 'other'
  newDueDate.value = ''
  newAssignee.value = ''
  newStatus.value = 'todo'
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
    description: newDescription.value.trim() || '',
    priority: newPriority.value,
    type: newType.value,
    due_date: newDueDate.value || null,
    assignee_id: newAssignee.value || null,
    status: newStatus.value,
    created_by: data.value?.myUserId
  })
  creating.value = false
  if (insertError) {
    errorMsg.value = t('error.generic')
    return
  }
  
  // Trigger LINE notification if assigned to someone
  if (newAssignee.value) {
    $fetch('/api/line/notify', {
      method: 'POST',
      body: {
        assigneeId: newAssignee.value,
        taskTitle: title,
        projectName: data.value?.project.name,
        projectId: projectId
      }
    }).catch(e => console.error('Failed to notify assignee:', e))
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

const taskToDelete = ref<BoardTask | null>(null)
const deleting = ref(false)

function askDelete(task: BoardTask) {
  taskToDelete.value = task
}

async function confirmDelete() {
  const task = taskToDelete.value
  if (!task) return
  deleting.value = true
  errorMsg.value = ''
  const { error: deleteError } = await supabase
    .from('tasks')
    .delete()
    .eq('id', task.id)
  deleting.value = false
  if (deleteError) {
    errorMsg.value = t('error.generic')
    return
  }
  taskToDelete.value = null
  await refresh()
}

const taskModal = useTaskModal()
watch(taskModal.refreshTrigger, () => refresh())

// --- display helpers ---
const formatDate = (iso?: string | null) => _formatDate(iso, locale.value)

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
      <!-- Create Task Full Page View -->
      <div v-if="showForm" class="mx-auto max-w-6xl pb-10">
        <!-- Breadcrumb & Header -->
        <div class="mb-6">
          <button
            type="button"
            class="text-sm text-text-muted hover:text-text flex items-center gap-1"
            @click="cancelForm"
          >
            <AppIcon name="chevron-left" class="h-4 w-4" />
            {{ data.project.name }} / {{ t('task.create') }}
          </button>
          
          <div class="mt-4 flex items-center gap-4">
            <span class="grid h-14 w-14 place-items-center rounded-2xl bg-gradient-to-br from-primary to-brand-accent/80 text-primary-fg shadow-sm">
              <AppIcon name="plus" class="h-6 w-6" />
            </span>
            <div>
              <h1 class="text-2xl font-bold text-text">{{ t('task.create') }}</h1>
              <p class="text-sm text-text-muted">{{ t('task.createSubtitle', 'เพิ่มงานใหม่เพื่อมอบหมายให้ทีม และติดตามความคืบหน้าได้ง่ายขึ้น') }}</p>
            </div>
          </div>
        </div>

        <div class="grid grid-cols-1 gap-6 lg:grid-cols-[1fr_300px]">
          <!-- Left: Main Form -->
          <form class="rounded-3xl bg-surface p-6 shadow-sm border border-border" @submit.prevent="createTask">
            <div class="grid gap-6">
              
              <!-- Row 1: Title & Type -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
                    <AppIcon name="dashboard" class="h-4 w-4 text-primary" />
                    ชื่องาน <span class="text-danger">*</span>
                  </label>
                  <input
                    ref="titleInput"
                    v-model="newTitle"
                    type="text"
                    maxlength="200"
                    placeholder="เช่น แก้ไขหน้า Dashboard"
                    class="w-full rounded-xl border border-border bg-surface px-4 py-2.5 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                    @keyup.esc="cancelForm"
                  />
                </div>
                <div>
                  <label class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
                    <AppIcon name="list" class="h-4 w-4 text-primary" />
                    หมวดหมู่
                  </label>
                  <AppSelect
                    v-model="newType"
                    :options="typeOptions"
                  />
                </div>
              </div>

              <!-- Row 2: Description -->
              <div>
                <label class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
                  <AppIcon name="edit" class="h-4 w-4 text-primary" />
                  รายละเอียด
                </label>
                <textarea
                  v-model="newDescription"
                  rows="4"
                  placeholder="อธิบายรายละเอียดของงาน เช่น สิ่งที่ต้องทำ / หมายเหตุเพิ่มเติม..."
                  class="w-full rounded-xl border border-border bg-surface px-4 py-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                ></textarea>
                <p class="mt-1 text-right text-xs text-text-muted">{{ newDescription.length }}/1000</p>
              </div>

              <!-- Row 3: Assignee, Due Date, Priority -->
              <div class="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div>
                  <label class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
                    <AppIcon name="user" class="h-4 w-4 text-text-muted" />
                    ผู้รับผิดชอบ
                  </label>
                  <AppSelect
                    v-model="newAssignee"
                    :options="assigneeOptions"
                    :placeholder="t('task.unassigned')"
                  />
                </div>
                <div>
                  <label class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
                    <AppIcon name="calendar" class="h-4 w-4 text-text-muted" />
                    กำหนดวันที่เสร็จสิ้น
                  </label>
                  <AppDatePicker v-model="newDueDate" placeholder="วว / ดด / ปปปป" />
                </div>
                <div>
                  <label class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
                    <AppIcon name="trending-up" class="h-4 w-4 text-text-muted" />
                    ความสำคัญ
                  </label>
                  <div class="flex gap-2">
                    <button type="button" @click="newPriority='low'" class="flex-1 rounded-xl border px-2 py-2 text-xs font-medium transition" :class="newPriority==='low' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted hover:bg-surface-alt'">ต่ำ</button>
                    <button type="button" @click="newPriority='medium'" class="flex-1 rounded-xl border px-2 py-2 text-xs font-medium transition" :class="newPriority==='medium' ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted hover:bg-surface-alt'">ปกติ</button>
                    <button type="button" @click="newPriority='high'" class="flex-1 rounded-xl border px-2 py-2 text-xs font-medium transition" :class="newPriority==='high' ? 'border-danger bg-danger/10 text-danger' : 'border-border text-text-muted hover:bg-surface-alt'">สูง</button>
                  </div>
                </div>
              </div>

              <!-- Row 4: Status -->
              <div class="grid grid-cols-1 md:grid-cols-2 gap-6">
                <div>
                  <label class="mb-2 flex items-center gap-1.5 text-sm font-semibold text-text">
                    <AppIcon name="clock" class="h-4 w-4 text-text-muted" />
                    สถานะ
                  </label>
                  <AppSelect
                    v-model="newStatus"
                    :options="[{value:'todo', label:'รอดำเนินการ'}, {value:'in_progress', label:'กำลังดำเนินการ'}, {value:'done', label:'เสร็จสิ้น'}]"
                  />
                </div>
              </div>
            </div>

            <hr class="my-6 border-border" />

            <div class="flex items-center justify-between">
              <p class="text-xs text-text-muted flex items-center gap-1.5">
                <AppIcon name="info" class="h-4 w-4" />
                หลังจากสร้างงานแล้ว คุณสามารถดูรายละเอียดและติดตามความคืบหน้าได้ในหน้าโปรเจกต์
              </p>
              <div class="flex items-center gap-3">
                <button type="button" class="rounded-xl border border-border px-5 py-2.5 text-sm font-medium text-text-muted transition hover:bg-surface-alt" @click="cancelForm">
                  ยกเลิก
                </button>
                <button type="submit" :disabled="creating || !newTitle.trim()" class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover disabled:opacity-60">
                  <AppIcon name="plus" class="h-4 w-4" />
                  {{ creating ? t('common.loading') : 'สร้างงาน' }}
                </button>
              </div>
            </div>
          </form>

          <!-- Right Sidebar -->
          <div class="space-y-6 hidden lg:block">
            
            <!-- Tips -->
            <div class="rounded-3xl bg-surface p-5 shadow-sm border border-border">
              <h3 class="mb-4 flex items-center gap-1.5 text-sm font-semibold text-primary">
                <AppIcon name="help" class="h-4 w-4" /> เคล็ดลับการสร้างงาน
              </h3>
              <ul class="space-y-3 text-sm text-text-muted">
                <li class="flex gap-2"><AppIcon name="check" class="h-4 w-4 shrink-0 text-primary" /> ตั้งชื่องานให้ชัดเจนและเข้าใจง่าย</li>
                <li class="flex gap-2"><AppIcon name="check" class="h-4 w-4 shrink-0 text-primary" /> ระบุผู้รับผิดชอบและกำหนดวันที่ให้ชัดเจน</li>
                <li class="flex gap-2"><AppIcon name="check" class="h-4 w-4 shrink-0 text-primary" /> จัดหมวดหมู่และค้นหาได้ง่าย</li>
                <li class="flex gap-2"><AppIcon name="check" class="h-4 w-4 shrink-0 text-primary" /> อัปเดตสถานะเมื่อมีความคืบหน้า</li>
              </ul>
            </div>
          </div>
        </div>
      </div>

      <!-- Board View -->
      <div v-else>
      <div class="flex flex-wrap items-end justify-between gap-3">
        <div>
          <button
            type="button"
            class="text-sm text-text-muted hover:text-text transition-colors flex items-center gap-1"
            @click="useRouter().options.history.state.back ? useRouter().back() : useRouter().push(`/workspaces/${data?.project.workspace_id}`)"
          >
            <AppIcon name="chevron-left" class="h-4 w-4" /> ย้อนกลับ
          </button>
          <h1 class="mt-1 text-2xl font-bold text-text">{{ data.project.name }}</h1>
          <p v-if="data.project.description" class="mt-1 max-w-xl text-sm text-text-muted">
            {{ data.project.description }}
          </p>
        </div>
        <button
          v-if="capabilities?.createTask"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover"
          @click="openForm"
        >
          <AppIcon name="plus" class="h-4 w-4" />
          {{ t('task.create') }}
        </button>
      </div>

      <p v-if="errorMsg && !showForm" class="mt-2 text-sm text-danger">{{ errorMsg }}</p>

      <!-- Status summary cards -->
      <div class="mt-8 grid gap-4 grid-cols-2 md:grid-cols-4">
        <div class="flex items-center gap-3 rounded-2xl border border-border bg-surface px-4 py-3 shadow-sm">
          <div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-surface-alt">
            <AppIcon name="tasks" class="h-5 w-5 text-text-muted" />
          </div>
          <div class="flex-1">
            <p class="text-sm font-semibold text-text">ทั้งหมด</p>
          </div>
          <span class="text-lg font-bold text-text">{{ data?.tasks.length ?? 0 }}</span>
        </div>
        <div class="flex items-center gap-3 rounded-2xl border border-primary/20 bg-primary/5 px-4 py-3 shadow-sm">
          <div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10">
            <AppIcon name="circle" class="h-5 w-5 text-primary" />
          </div>
          <div class="flex-1">
            <p class="text-sm font-semibold text-primary">{{ t('taskStatus.todo') }}</p>
          </div>
          <span class="text-lg font-bold text-primary">{{ columns.todo.length }}</span>
        </div>
        <div class="flex items-center gap-3 rounded-2xl border border-warning/20 bg-warning/5 px-4 py-3 shadow-sm">
          <div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-warning/10">
            <AppIcon name="play" class="h-5 w-5 text-warning" />
          </div>
          <div class="flex-1">
            <p class="text-sm font-semibold text-warning">{{ t('taskStatus.in_progress') }}</p>
          </div>
          <span class="text-lg font-bold text-warning">{{ columns.in_progress.length }}</span>
        </div>
        <div class="flex items-center gap-3 rounded-2xl border border-success/20 bg-success/5 px-4 py-3 shadow-sm">
          <div class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-success/10">
            <AppIcon name="check-circle" class="h-5 w-5 text-success" />
          </div>
          <div class="flex-1">
            <p class="text-sm font-semibold text-success">{{ t('taskStatus.done') }}</p>
          </div>
          <span class="text-lg font-bold text-success">{{ columns.done.length }}</span>
        </div>
      </div>

      <!-- Filters -->
      <div class="mt-6 flex flex-wrap items-center justify-between gap-4 rounded-2xl bg-surface p-2 shadow-sm border border-border">
        <div class="flex items-center gap-2 px-2 flex-1 min-w-[200px]">
          <AppIcon name="search" class="h-5 w-5 text-text-muted shrink-0" />
          <input v-model="searchQuery" type="text" :placeholder="t('task.searchPlaceholder')" class="bg-transparent text-sm focus:outline-none w-full text-text" />
        </div>
        <div class="flex items-center gap-2 flex-wrap shrink-0 pr-2">
          <div class="w-40">
            <AppSelect v-model="filterAssignee" :options="filterAssigneeOptions" icon="user" />
          </div>
          <div class="w-44">
            <AppSelect v-model="filterPriority" :options="filterPriorityOptions" icon="flag" />
          </div>
        </div>
      </div>

      <div class="mt-6 grid gap-6 md:grid-cols-3">
        <section
          v-for="status in TASK_STATUSES"
          :key="status"
          class="flex flex-col gap-4 rounded-3xl bg-surface-alt/40 p-4"
        >
          <div class="flex items-center justify-between px-1">
            <h2 class="flex items-center gap-2 text-base font-bold text-text">
              <AppIcon v-if="status === 'todo'" name="circle" class="h-5 w-5 text-primary" />
              <AppIcon v-else-if="status === 'in_progress'" name="play" class="h-5 w-5 text-warning" />
              <AppIcon v-else-if="status === 'done'" name="check-circle" class="h-5 w-5 text-success" />
              {{ t(`taskStatus.${status}`) }}
              <span class="rounded-full bg-surface px-2.5 py-0.5 text-sm font-semibold text-text shadow-sm">
                {{ columns[status].length }}
              </span>
            </h2>
            <button v-if="columns[status].length > 5 && !expandedColumns[status]" class="text-xs font-medium text-primary hover:underline" @click="expandedColumns[status] = true">ดูทั้งหมด &rarr;</button>
            <button v-if="columns[status].length > 5 && expandedColumns[status]" class="text-xs font-medium text-primary hover:underline" @click="expandedColumns[status] = false">ซ่อน &larr;</button>
          </div>

          <p v-if="columns[status].length === 0" class="mt-2 px-2 text-sm text-text-muted text-center py-8">
            {{ t('task.emptyColumn') }}
          </p>

          <div v-else class="flex flex-col gap-3">
            <article
              v-for="task in (expandedColumns[status] ? columns[status] : columns[status].slice(0, 5))"
              :key="task.id"
              class="group relative rounded-2xl border border-border bg-surface p-4 shadow-sm transition-all hover:-translate-y-0.5 hover:shadow-md cursor-pointer"
              @click="taskModal.open(task.id)"
            >
              <!-- Card Header -->
              <div class="flex items-start gap-3">
                <button type="button" class="mt-0.5 shrink-0 text-text-muted hover:text-primary transition" @click.stop="taskModal.open(task.id)">
                  <AppIcon :name="status === 'done' ? 'check-circle' : 'circle'" class="h-5 w-5" :class="status === 'done' ? 'text-success' : ''" />
                </button>
                <div class="flex-1 min-w-0">
                  <h3 class="font-bold text-text truncate group-hover:text-primary transition-colors">
                    {{ task.title }}
                  </h3>
                  <p class="mt-1 text-xs text-text-muted line-clamp-2 leading-relaxed">
                    {{ task.description || 'ไม่มีรายละเอียดเพิ่มเติม' }}
                  </p>
                </div>
                <!-- Delete Button (appears on hover) -->
                <button
                  v-if="capabilities?.deleteTask"
                  type="button"
                  class="shrink-0 rounded-xl bg-surface-alt p-1.5 opacity-0 transition group-hover:opacity-100 hover:bg-danger/10 hover:text-danger text-text-muted"
                  :aria-label="t('common.delete')"
                  @click.stop="askDelete(task)"
                >
                  <AppIcon name="trash" class="h-4 w-4" />
                </button>
              </div>

              <!-- Type Badge -->
              <div class="mt-3 flex">
                <span class="inline-flex items-center gap-1 rounded-lg border border-border bg-surface px-2 py-1 text-[10px] font-semibold text-text-muted">
                  {{ t(`taskType.${task.type}`) }}
                </span>
              </div>

              <hr class="my-3 border-border" />

              <!-- Card Footer -->
              <div class="flex items-center justify-between gap-2 text-xs">
                <div class="flex items-center gap-3">
                  <span
                    v-if="task.due_date"
                    class="flex items-center gap-1 font-medium"
                    :class="DUE_CLASSES[getDueStatus(task.due_date, new Date(), task.status === 'done')]"
                  >
                    <AppIcon name="calendar" class="h-3.5 w-3.5 opacity-70" />
                    {{ formatDate(task.due_date) }}
                  </span>
                  <div v-if="task.assignee" class="flex items-center gap-1.5 text-text-muted">
                    <AppAvatar :src="task.assignee.avatar_url" :name="task.assignee.display_name" size="h-5 w-5" />
                    <span class="truncate max-w-[80px]">{{ task.assignee.display_name }}</span>
                  </div>
                </div>
                <span
                  class="rounded-lg border px-2 py-0.5 font-semibold"
                  :class="[
                    task.priority === 'low' ? 'border-success/30 bg-success/5 text-success' : '',
                    task.priority === 'medium' ? 'border-warning/30 bg-warning/5 text-warning' : '',
                    task.priority === 'high' ? 'border-danger/30 bg-danger/5 text-danger' : '',
                    task.priority === 'critical' ? 'border-priority-critical/30 bg-priority-critical/5 text-priority-critical' : ''
                  ]"
                >
                  {{ t(`taskPriority.${task.priority}`) }}
                </span>
              </div>
            </article>
          </div>
          
          <button v-if="columns[status].length > 5 && !expandedColumns[status]" type="button" class="mt-2 w-full rounded-xl bg-surface-alt py-2.5 text-sm font-semibold text-text-muted transition hover:bg-surface-alt/80 hover:text-text" @click="expandedColumns[status] = true">
            ดูทั้งหมด ({{ columns[status].length }}) &rsaquo;
          </button>
          <button v-if="columns[status].length > 5 && expandedColumns[status]" type="button" class="mt-2 w-full rounded-xl bg-surface-alt py-2.5 text-sm font-semibold text-text-muted transition hover:bg-surface-alt/80 hover:text-text" @click="expandedColumns[status] = false">
            ซ่อน &lsaquo;
          </button>
        </section>
      </div>
      </div>
    </template>



    <!-- Delete task confirmation -->
    <AppModal :show="!!taskToDelete" max-width="max-w-sm" @close="taskToDelete = null">
      <div v-if="taskToDelete" class="text-center">
        <span class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-danger/10 text-danger">
          <AppIcon name="trash" class="h-6 w-6" />
        </span>
        <h2 class="mt-4 text-lg font-bold text-text">{{ t('task.deleteTitle') }}</h2>
        <p class="mt-2 text-sm text-text-muted">
          {{ t('task.deleteConfirm', { title: taskToDelete.title }) }}
        </p>
        <div class="mt-6 flex justify-center gap-3">
          <button
            type="button"
            class="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-muted transition hover:text-text"
            @click="taskToDelete = null"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            :disabled="deleting"
            class="flex-1 inline-flex items-center justify-center gap-1.5 rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-primary-fg shadow-sm transition hover:opacity-90 disabled:opacity-60"
            @click="confirmDelete"
          >
            <AppIcon name="trash" class="h-4 w-4" />
            {{ deleting ? t('common.loading') : t('common.delete') }}
          </button>
        </div>
      </div>
    </AppModal>
  </div>
</template>
