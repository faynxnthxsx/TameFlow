import { describe, expect, it } from 'vitest'
import { getDueStatus } from '../../app/utils/dates'

const NOW = new Date('2026-07-03T00:00:00Z')

describe('getDueStatus', () => {
  it('returns none when there is no due date', () => {
    expect(getDueStatus(null, NOW)).toBe('none')
  })

  it('returns none when the task is already completed', () => {
    expect(getDueStatus('2026-06-01T00:00:00Z', NOW, true)).toBe('none')
  })

  it('returns overdue for a past due date', () => {
    expect(getDueStatus('2026-07-01T00:00:00Z', NOW)).toBe('overdue')
  })

  it('returns due-soon within the next 3 days', () => {
    expect(getDueStatus('2026-07-05T00:00:00Z', NOW)).toBe('due-soon')
  })

  it('returns upcoming beyond 3 days', () => {
    expect(getDueStatus('2026-07-20T00:00:00Z', NOW)).toBe('upcoming')
  })
})
