import { describe, expect, it } from 'vitest'
import {
  groupTasksByStatus,
  isTaskPriority,
  isTaskStatus,
  nextStatus,
  prevStatus
} from '~/utils/tasks'

describe('isTaskStatus / isTaskPriority', () => {
  it('accepts known values', () => {
    expect(isTaskStatus('todo')).toBe(true)
    expect(isTaskStatus('in_progress')).toBe(true)
    expect(isTaskStatus('done')).toBe(true)
    expect(isTaskPriority('low')).toBe(true)
    expect(isTaskPriority('critical')).toBe(true)
  })

  it('rejects unknown values', () => {
    expect(isTaskStatus('archived')).toBe(false)
    expect(isTaskStatus(null)).toBe(false)
    expect(isTaskPriority('urgent')).toBe(false)
    expect(isTaskPriority(undefined)).toBe(false)
  })
})

describe('nextStatus / prevStatus', () => {
  it('walks the todo → in_progress → done pipeline', () => {
    expect(nextStatus('todo')).toBe('in_progress')
    expect(nextStatus('in_progress')).toBe('done')
    expect(nextStatus('done')).toBeNull()
    expect(prevStatus('done')).toBe('in_progress')
    expect(prevStatus('in_progress')).toBe('todo')
    expect(prevStatus('todo')).toBeNull()
  })
})

describe('groupTasksByStatus', () => {
  it('returns all buckets even when empty', () => {
    const groups = groupTasksByStatus([])
    expect(groups.todo).toEqual([])
    expect(groups.in_progress).toEqual([])
    expect(groups.done).toEqual([])
  })

  it('groups tasks into their status bucket preserving order', () => {
    const tasks = [
      { id: 1, status: 'todo' as const },
      { id: 2, status: 'done' as const },
      { id: 3, status: 'todo' as const }
    ]
    const groups = groupTasksByStatus(tasks)
    expect(groups.todo.map((t) => t.id)).toEqual([1, 3])
    expect(groups.in_progress).toEqual([])
    expect(groups.done.map((t) => t.id)).toEqual([2])
  })
})
