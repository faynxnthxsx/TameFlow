export type WorkspaceRole = 'owner' | 'admin' | 'member' | 'viewer'

export interface Capabilities {
  manageWorkspace: boolean
  manageMembers: boolean
  manageProjects: boolean
  manageChat: boolean
  createTask: boolean
  editAnyTask: boolean
  editOwnTask: boolean
  deleteTask: boolean
  viewOnly: boolean
}

const CAPABILITIES_BY_ROLE: Record<WorkspaceRole, Capabilities> = {
  owner: {
    manageWorkspace: true,
    manageMembers: true,
    manageProjects: true,
    manageChat: true,
    createTask: true,
    editAnyTask: true,
    editOwnTask: true,
    deleteTask: true,
    viewOnly: false
  },
  admin: {
    manageWorkspace: false,
    manageMembers: true,
    manageProjects: true,
    manageChat: true,
    createTask: true,
    editAnyTask: true,
    editOwnTask: true,
    deleteTask: true,
    viewOnly: false
  },
  member: {
    manageWorkspace: false,
    manageMembers: false,
    manageProjects: false,
    manageChat: false,
    createTask: true,
    editAnyTask: false,
    editOwnTask: true,
    deleteTask: false,
    viewOnly: false
  },
  viewer: {
    manageWorkspace: false,
    manageMembers: false,
    manageProjects: false,
    manageChat: false,
    createTask: false,
    editAnyTask: false,
    editOwnTask: false,
    deleteTask: false,
    viewOnly: true
  }
}

export function resolveCapabilities(role: WorkspaceRole): Capabilities {
  return CAPABILITIES_BY_ROLE[role]
}

export function canEditTask(role: WorkspaceRole, isOwnTask: boolean): boolean {
  const caps = resolveCapabilities(role)
  return caps.editAnyTask || (caps.editOwnTask && isOwnTask)
}
