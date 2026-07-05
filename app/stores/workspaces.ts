import type { WorkspaceRole } from '~/utils/permissions'

export interface WorkspaceSummary {
  id: string
  name: string
  createdAt: string
  role: WorkspaceRole
}

export const useWorkspacesStore = defineStore('workspaces', () => {
  const supabase = useSupabaseClient()

  const workspaces = ref<WorkspaceSummary[]>([])
  const loaded = ref(false)

  async function fetchWorkspaces() {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('role, workspace:workspaces (id, name, created_at)')
      .order('created_at', { ascending: true })
    if (error) throw error

    workspaces.value = (data ?? [])
      .filter((row) => row.workspace !== null)
      .map((row) => ({
        id: row.workspace!.id,
        name: row.workspace!.name,
        createdAt: row.workspace!.created_at,
        role: row.role as WorkspaceRole
      }))
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

  return { workspaces, loaded, fetchWorkspaces, createWorkspace }
})
