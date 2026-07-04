export interface ChecklistItemLike {
  is_done: boolean
}

export function checklistCompletionPct(items: ChecklistItemLike[]): number {
  if (items.length === 0) return 0
  const done = items.filter((item) => item.is_done).length
  return Math.round((done / items.length) * 100)
}
