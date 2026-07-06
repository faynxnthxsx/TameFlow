import type { RealtimeChannel } from '@supabase/supabase-js'
import type { WorkspaceRole } from '~/utils/permissions'

export interface ChatMessage {
  id: string
  userId: string
  body: string
  createdAt: string
  authorName: string
  authorAvatar: string | null
}

export interface ChatMember {
  id: string
  name: string
  avatar: string | null
  role: WorkspaceRole
}

export const DEFAULT_CHAT_COLOR = '#2563eb'

// An Instagram/Messenger-like palette for the per-team chat color — a full
// spectrum so teams have plenty to choose from in the theme popup.
export const CHAT_COLORS = [
  '#2563eb', // blue
  '#3b82f6', // sky
  '#0891b2', // teal
  '#06b6d4', // cyan
  '#16a34a', // green
  '#65a30d', // lime
  '#ca8a04', // gold
  '#ea580c', // orange
  '#dc2626', // red
  '#e11d48', // rose
  '#db2777', // pink
  '#c026d3', // fuchsia
  '#7c3aed', // purple
  '#4f46e5', // indigo
  '#475569' // slate
]

export const useChatStore = defineStore('chat', () => {
  const supabase = useSupabaseClient()

  const messages = ref<ChatMessage[]>([])
  const members = ref<ChatMember[]>([])
  const color = ref<string>(DEFAULT_CHAT_COLOR)
  const loading = ref(false)
  let channel: RealtimeChannel | null = null

  function mapRow(row: {
    id: string
    user_id: string
    body: string
    created_at: string
    author: { display_name: string | null; avatar_url: string | null } | null
  }): ChatMessage {
    return {
      id: row.id,
      userId: row.user_id,
      body: row.body,
      createdAt: row.created_at,
      authorName: row.author?.display_name || 'User',
      authorAvatar: row.author?.avatar_url ?? null
    }
  }

  async function fetchMessages(workspaceId: string) {
    loading.value = true
    try {
      const { data, error } = await supabase
        .from('chat_messages')
        .select('id, user_id, body, created_at, author:user_profiles (display_name, avatar_url)')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true })
        .limit(200)
      if (error) throw error
      messages.value = (data ?? []).map(mapRow as never)
    } finally {
      loading.value = false
    }
  }

  async function sendMessage(workspaceId: string, body: string) {
    const trimmed = body.trim()
    if (!trimmed) return
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id
    if (!uid) return
    const { error } = await supabase
      .from('chat_messages')
      .insert({ workspace_id: workspaceId, user_id: uid, body: trimmed })
    if (error) throw error
    // Refetch so our own message shows immediately even if realtime is slow.
    await fetchMessages(workspaceId)
  }

  // Roster for the team-details panel. RLS lets any member read the members
  // of their own workspaces.
  async function fetchMembers(workspaceId: string) {
    const { data, error } = await supabase
      .from('workspace_members')
      .select('role, member:user_profiles (id, display_name, avatar_url)')
      .eq('workspace_id', workspaceId)
    if (error) throw error
    members.value = (data ?? [])
      .filter((row: { member: unknown }) => row.member !== null)
      .map((row: { role: string; member: { id: string; display_name: string | null; avatar_url: string | null } }) => ({
        id: row.member.id,
        name: row.member.display_name || 'User',
        avatar: row.member.avatar_url ?? null,
        role: row.role as WorkspaceRole
      }))
  }

  async function fetchColor(workspaceId: string) {
    const { data } = await supabase
      .from('workspace_chat_settings')
      .select('color')
      .eq('workspace_id', workspaceId)
      .maybeSingle()
    color.value = data?.color ?? DEFAULT_CHAT_COLOR
  }

  async function setColor(workspaceId: string, next: string) {
    color.value = next
    const { error } = await supabase
      .from('workspace_chat_settings')
      .upsert({ workspace_id: workspaceId, color: next }, { onConflict: 'workspace_id' })
    if (error) throw error
  }

  // Subscribe to live inserts for one workspace; refetch on any new message.
  function subscribe(workspaceId: string) {
    unsubscribe()
    channel = supabase
      .channel(`chat:${workspaceId}`)
      .on(
        'postgres_changes',
        {
          event: 'INSERT',
          schema: 'public',
          table: 'chat_messages',
          filter: `workspace_id=eq.${workspaceId}`
        },
        () => {
          fetchMessages(workspaceId)
        }
      )
      .subscribe()
  }

  function unsubscribe() {
    if (channel) {
      supabase.removeChannel(channel)
      channel = null
    }
  }

  function reset() {
    messages.value = []
    members.value = []
    color.value = DEFAULT_CHAT_COLOR
  }

  return {
    messages,
    members,
    color,
    loading,
    fetchMessages,
    fetchMembers,
    sendMessage,
    fetchColor,
    setColor,
    subscribe,
    unsubscribe,
    reset
  }
})
