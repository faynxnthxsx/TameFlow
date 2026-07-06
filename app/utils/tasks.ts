// Values must stay in sync with the check constraints in
// supabase/migrations/20260704120000_projects_tasks.sql. Priority names
// also match the --tf-color-priority-* theme tokens.
export const TASK_STATUSES = ['todo', 'in_progress', 'done'] as const
export type TaskStatus = (typeof TASK_STATUSES)[number]

export const TASK_PRIORITIES = ['low', 'medium', 'high', 'critical'] as const
export type TaskPriority = (typeof TASK_PRIORITIES)[number]

// Categories for the company-overview "task type" donut. Must stay in sync
// with the type check constraint in
// supabase/migrations/20260706120000_task_type.sql.
export const TASK_TYPES = ['dev', 'design', 'test', 'other'] as const
export type TaskType = (typeof TASK_TYPES)[number]

export function isTaskStatus(value: unknown): value is TaskStatus {
  return TASK_STATUSES.includes(value as TaskStatus)
}

export function isTaskPriority(value: unknown): value is TaskPriority {
  return TASK_PRIORITIES.includes(value as TaskPriority)
}

export function isTaskType(value: unknown): value is TaskType {
  return TASK_TYPES.includes(value as TaskType)
}

export function nextStatus(status: TaskStatus): TaskStatus | null {
  const i = TASK_STATUSES.indexOf(status)
  return TASK_STATUSES[i + 1] ?? null
}

export function prevStatus(status: TaskStatus): TaskStatus | null {
  const i = TASK_STATUSES.indexOf(status)
  return i > 0 ? TASK_STATUSES[i - 1] : null
}

export interface TaskStatusLike {
  status: TaskStatus
}

export function groupTasksByStatus<T extends TaskStatusLike>(
  tasks: T[]
): Record<TaskStatus, T[]> {
  const groups = { todo: [], in_progress: [], done: [] } as Record<
    TaskStatus,
    T[]
  >
  for (const task of tasks) {
    groups[task.status].push(task)
  }
  return groups
}
