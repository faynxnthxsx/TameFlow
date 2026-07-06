import { describe, expect, it } from 'vitest'
import { canEditTask, resolveCapabilities } from '../../app/utils/permissions'

describe('resolveCapabilities', () => {
  it('grants owners full control', () => {
    const caps = resolveCapabilities('owner')
    expect(caps.manageWorkspace).toBe(true)
    expect(caps.deleteTask).toBe(true)
  })

  it('restricts viewers to read-only', () => {
    const caps = resolveCapabilities('viewer')
    expect(caps.viewOnly).toBe(true)
    expect(caps.createTask).toBe(false)
    expect(caps.editOwnTask).toBe(false)
  })

  it('lets members create and edit only their own tasks', () => {
    const caps = resolveCapabilities('member')
    expect(caps.createTask).toBe(true)
    expect(caps.editAnyTask).toBe(false)
    expect(caps.editOwnTask).toBe(true)
  })

  it('lets only owners and admins manage chat settings', () => {
    expect(resolveCapabilities('owner').manageChat).toBe(true)
    expect(resolveCapabilities('admin').manageChat).toBe(true)
    expect(resolveCapabilities('member').manageChat).toBe(false)
    expect(resolveCapabilities('viewer').manageChat).toBe(false)
  })
})

describe('canEditTask', () => {
  it('allows admins to edit any task', () => {
    expect(canEditTask('admin', false)).toBe(true)
  })

  it('allows members to edit only their own task', () => {
    expect(canEditTask('member', true)).toBe(true)
    expect(canEditTask('member', false)).toBe(false)
  })

  it('never allows viewers to edit', () => {
    expect(canEditTask('viewer', true)).toBe(false)
  })
})
