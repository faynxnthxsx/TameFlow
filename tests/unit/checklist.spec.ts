import { describe, expect, it } from 'vitest'
import { checklistCompletionPct } from '../../app/utils/checklist'

describe('checklistCompletionPct', () => {
  it('returns 0 for an empty checklist', () => {
    expect(checklistCompletionPct([])).toBe(0)
  })

  it('returns 0 when nothing is done', () => {
    expect(checklistCompletionPct([{ is_done: false }, { is_done: false }])).toBe(0)
  })

  it('returns 100 when everything is done', () => {
    expect(checklistCompletionPct([{ is_done: true }, { is_done: true }])).toBe(100)
  })

  it('rounds partial completion', () => {
    expect(checklistCompletionPct([{ is_done: true }, { is_done: false }, { is_done: false }])).toBe(33)
  })
})
