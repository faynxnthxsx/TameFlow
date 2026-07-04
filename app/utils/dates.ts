export type DueStatus = 'none' | 'overdue' | 'due-soon' | 'upcoming'

const DUE_SOON_DAYS = 3

export function getDueStatus(
  dueDate: string | Date | null | undefined,
  now: Date = new Date(),
  isCompleted = false
): DueStatus {
  if (!dueDate || isCompleted) return 'none'
  const due = typeof dueDate === 'string' ? new Date(dueDate) : dueDate
  const diffDays = (due.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)
  if (diffDays < 0) return 'overdue'
  if (diffDays <= DUE_SOON_DAYS) return 'due-soon'
  return 'upcoming'
}
