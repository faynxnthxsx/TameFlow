import type { WorkspaceRole } from '~/utils/permissions'
import type { TaskStatus, TaskType } from '~/utils/tasks'
import { isTaskType } from '~/utils/tasks'

// A member's identity for the overlapping avatar stack on a workspace card.
export interface WorkspaceMemberAvatar {
  id: string
  name: string
  avatar: string | null
}

export interface WorkspaceSummary {
  id: string
  name: string
  createdAt: string
  updatedAt: string
  role: WorkspaceRole
  memberCount: number
  projectCount: number
  taskCount: number
  doneCount: number
  progress: number // 0–100, done / total tasks
  memberAvatars: WorkspaceMemberAvatar[] // first few, for the avatar stack
}

export interface OverviewMember {
  id: string
  name: string
  avatar: string | null
  role: WorkspaceRole
}

// A project row for the "recent projects" panel on the company overview.
export interface CompanyProject {
  id: string
  name: string
  workspaceId: string
  workspaceName: string
  createdAt: string
  memberCount: number
  taskTotal: number
  taskDone: number
}

// One entry in the "recent activity" feed. Derived from real project/task
// rows — no dedicated activity table.
export interface ActivityItem {
  id: string
  kind: 'project_created' | 'task_created' | 'task_done'
  title: string
  context: string
  actor: string | null
  at: string
}

// Everything the /overview company dashboard renders, rolled up client-side
// over existing RLS (three bulk reads, grouped in JS — no new tables/RPCs).
export interface CompanyDashboard {
  totals: {
    teams: number
    projects: number
    tasks: number
    done: number
    members: number
  }
  status: Record<TaskStatus, number>
  overdue: number
  dueSoon: number
  types: Record<TaskType, number>
  members: OverviewMember[]
  recentProjects: CompanyProject[]
  activity: ActivityItem[]
}

export const useWorkspacesStore = defineStore('workspaces', () => {
  const supabase = useSupabaseClient()

  const workspaces = ref<WorkspaceSummary[]>([])
  const loaded = ref(false)

  async function fetchWorkspaces() {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('role, workspace:workspaces (id, name, created_at, updated_at)')
      .order('created_at', { ascending: true })
    if (error) throw error

    const bases = (data ?? [])
      .filter((row) => row.workspace !== null)
      .map((row) => ({
        id: row.workspace!.id,
        name: row.workspace!.name,
        createdAt: row.workspace!.created_at,
        updatedAt: row.workspace!.updated_at,
        role: row.role as WorkspaceRole
      }))
    const ids = bases.map((b) => b.id)

    // Per-workspace stats rolled up client-side over RLS — three bulk reads
    // grouped in JS (same pattern as fetchOverview; no new tables/RPCs).
    const memberCount = new Map<string, number>()
    const memberAvatars = new Map<string, WorkspaceMemberAvatar[]>()
    const projectCount = new Map<string, number>()
    const taskCount = new Map<string, number>()
    const doneCount = new Map<string, number>()

    if (ids.length > 0) {
      const [membersRes, projectsRes, tasksRes] = await Promise.all([
        supabase
          .from('workspace_members')
          .select('workspace_id, user:user_profiles (id, display_name, avatar_url)')
          .in('workspace_id', ids),
        supabase
          .from('projects')
          .select('id, workspace_id')
          .in('workspace_id', ids),
        supabase
          .from('tasks')
          .select('id, workspace_id, status')
          .in('workspace_id', ids)
      ])

      for (const m of (membersRes.data ?? []) as Array<{
        workspace_id: string
        user: { id: string; display_name: string | null; avatar_url: string | null } | null
      }>) {
        memberCount.set(m.workspace_id, (memberCount.get(m.workspace_id) ?? 0) + 1)
        if (m.user) {
          const arr = memberAvatars.get(m.workspace_id) ?? []
          if (arr.length < 5) {
            arr.push({ id: m.user.id, name: m.user.display_name || 'User', avatar: m.user.avatar_url ?? null })
          }
          memberAvatars.set(m.workspace_id, arr)
        }
      }
      for (const p of (projectsRes.data ?? []) as Array<{ id: string; workspace_id: string }>) {
        projectCount.set(p.workspace_id, (projectCount.get(p.workspace_id) ?? 0) + 1)
      }
      for (const tk of (tasksRes.data ?? []) as Array<{ id: string; workspace_id: string; status: string }>) {
        taskCount.set(tk.workspace_id, (taskCount.get(tk.workspace_id) ?? 0) + 1)
        if (tk.status === 'done') doneCount.set(tk.workspace_id, (doneCount.get(tk.workspace_id) ?? 0) + 1)
      }
    }

    workspaces.value = bases.map((b) => {
      const total = taskCount.get(b.id) ?? 0
      const done = doneCount.get(b.id) ?? 0
      return {
        ...b,
        memberCount: memberCount.get(b.id) ?? 0,
        projectCount: projectCount.get(b.id) ?? 0,
        taskCount: total,
        doneCount: done,
        progress: total > 0 ? Math.round((done / total) * 100) : 0,
        memberAvatars: memberAvatars.get(b.id) ?? []
      }
    })
    loaded.value = true
  }

  async function createWorkspace(name: string): Promise<string> {
    const { data, error } = await supabase.rpc('create_workspace', {
      workspace_name: name
    })
    if (error) throw error
    await fetchWorkspaces()
    return data
  }

  // Company-owner overview: roll up every team the user belongs to into one
  // dashboard. RLS already scopes each read to the caller's workspaces, so
  // this is a handful of bulk reads grouped client-side — no new tables or
  // policies needed (see CLAUDE.md "Cross-team read-only aggregation").
  async function fetchOverview(): Promise<CompanyDashboard> {
    const empty: CompanyDashboard = {
      totals: { teams: 0, projects: 0, tasks: 0, done: 0, members: 0 },
      status: { todo: 0, in_progress: 0, done: 0 },
      overdue: 0,
      dueSoon: 0,
      types: { dev: 0, design: 0, test: 0, other: 0 },
      members: [],
      recentProjects: [],
      activity: []
    }

    const { data: memberships, error } = await supabase
      .from('workspace_members')
      .select('role, workspace:workspaces (id, name, created_at)')
      .order('created_at', { ascending: true })
    if (error) throw error

    const bases = (memberships ?? [])
      .filter((row) => row.workspace !== null)
      .map((row) => ({
        id: row.workspace!.id as string,
        name: row.workspace!.name as string,
        role: row.role as WorkspaceRole
      }))
    const ids = bases.map((b) => b.id)
    if (ids.length === 0) return empty

    const wsName = new Map(bases.map((b) => [b.id, b.name]))

    const [membersRes, projectsRes, tasksRes] = await Promise.all([
      supabase
        .from('workspace_members')
        .select('workspace_id, role, user:user_profiles (id, display_name, avatar_url)')
        .in('workspace_id', ids),
      supabase
        .from('projects')
        .select('id, name, workspace_id, created_by, created_at')
        .in('workspace_id', ids),
      supabase
        .from('tasks')
        .select('id, title, project_id, workspace_id, status, type, due_date, created_by, created_at, updated_at')
        .in('workspace_id', ids)
    ])

    const allMembers = (membersRes.data ?? []) as Array<{
      workspace_id: string
      role: string
      user: { id: string; display_name: string | null; avatar_url: string | null } | null
    }>
    const allProjects = (projectsRes.data ?? []) as Array<{
      id: string
      name: string
      workspace_id: string
      created_by: string | null
      created_at: string
    }>
    const allTasks = (tasksRes.data ?? []) as Array<{
      id: string
      title: string
      project_id: string
      workspace_id: string
      status: string
      type: string
      due_date: string | null
      created_by: string | null
      created_at: string
      updated_at: string
    }>

    // --- lookups ---
    const userName = new Map<string, string>()
    const memberCountByWs = new Map<string, number>()
    for (const m of allMembers) {
      memberCountByWs.set(m.workspace_id, (memberCountByWs.get(m.workspace_id) ?? 0) + 1)
      if (m.user) userName.set(m.user.id, m.user.display_name || 'User')
    }
    const projectName = new Map(allProjects.map((p) => [p.id, p.name]))

    // --- unique company members (a person may be in several teams) ---
    const memberMap = new Map<string, OverviewMember>()
    for (const m of allMembers) {
      if (m.user && !memberMap.has(m.user.id)) {
        memberMap.set(m.user.id, {
          id: m.user.id,
          name: m.user.display_name || 'User',
          avatar: m.user.avatar_url ?? null,
          role: m.role as WorkspaceRole
        })
      }
    }

    // --- status / type counts + due-date derived numbers ---
    const status: Record<TaskStatus, number> = { todo: 0, in_progress: 0, done: 0 }
    const types: Record<TaskType, number> = { dev: 0, design: 0, test: 0, other: 0 }
    let overdue = 0
    let dueSoon = 0
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const soon = new Date(today)
    soon.setDate(soon.getDate() + 7)
    for (const tk of allTasks) {
      if (tk.status === 'todo' || tk.status === 'in_progress' || tk.status === 'done') {
        status[tk.status]++
      }
      types[isTaskType(tk.type) ? tk.type : 'other']++
      if (tk.due_date && tk.status !== 'done') {
        const due = new Date(tk.due_date)
        if (due < today) overdue++
        else if (due <= soon) dueSoon++
      }
    }
    const done = status.done

    // --- per-project task tallies for the "recent projects" panel ---
    const projTotal = new Map<string, number>()
    const projDone = new Map<string, number>()
    for (const tk of allTasks) {
      projTotal.set(tk.project_id, (projTotal.get(tk.project_id) ?? 0) + 1)
      if (tk.status === 'done') projDone.set(tk.project_id, (projDone.get(tk.project_id) ?? 0) + 1)
    }
    const recentProjects: CompanyProject[] = [...allProjects]
      .sort((a, b) => b.created_at.localeCompare(a.created_at))
      .slice(0, 5)
      .map((p) => ({
        id: p.id,
        name: p.name,
        workspaceId: p.workspace_id,
        workspaceName: wsName.get(p.workspace_id) ?? '',
        createdAt: p.created_at,
        memberCount: memberCountByWs.get(p.workspace_id) ?? 0,
        taskTotal: projTotal.get(p.id) ?? 0,
        taskDone: projDone.get(p.id) ?? 0
      }))

    // --- recent activity, merged from real project/task rows ---
    const activity: ActivityItem[] = []
    for (const p of allProjects) {
      activity.push({
        id: `p-${p.id}`,
        kind: 'project_created',
        title: p.name,
        context: wsName.get(p.workspace_id) ?? '',
        actor: p.created_by ? userName.get(p.created_by) ?? null : null,
        at: p.created_at
      })
    }
    for (const tk of allTasks) {
      activity.push({
        id: `tc-${tk.id}`,
        kind: 'task_created',
        title: tk.title,
        context: projectName.get(tk.project_id) ?? '',
        actor: tk.created_by ? userName.get(tk.created_by) ?? null : null,
        at: tk.created_at
      })
      if (tk.status === 'done') {
        activity.push({
          id: `td-${tk.id}`,
          kind: 'task_done',
          title: tk.title,
          context: projectName.get(tk.project_id) ?? '',
          actor: null,
          at: tk.updated_at
        })
      }
    }
    activity.sort((a, b) => b.at.localeCompare(a.at))

    return {
      totals: {
        teams: bases.length,
        projects: allProjects.length,
        tasks: allTasks.length,
        done,
        members: memberMap.size
      },
      status,
      overdue,
      dueSoon,
      types,
      members: [...memberMap.values()],
      recentProjects,
      activity: activity.slice(0, 8)
    }
  }

  return { workspaces, loaded, fetchWorkspaces, createWorkspace, fetchOverview }
})
