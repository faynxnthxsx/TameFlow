// Hand-written to match supabase/migrations. Once the Supabase CLI is
// linked, regenerate after each migration with:
//   supabase gen types typescript --linked > app/types/database.types.ts
export type Database = {
  public: {
    Tables: {
      user_profiles: {
        Row: {
          id: string
          display_name: string | null
          avatar_url: string | null
          preferred_language: string
          preferred_theme: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id: string
          display_name?: string | null
          avatar_url?: string | null
          preferred_language?: string
          preferred_theme?: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          display_name?: string | null
          avatar_url?: string | null
          preferred_language?: string
          preferred_theme?: string
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspaces: {
        Row: {
          id: string
          name: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: []
      }
      workspace_members: {
        Row: {
          workspace_id: string
          user_id: string
          role: string
          created_at: string
        }
        Insert: {
          workspace_id: string
          user_id: string
          role?: string
          created_at?: string
        }
        Update: {
          workspace_id?: string
          user_id?: string
          role?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspace_members_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'workspace_members_user_id_fkey'
            columns: ['user_id']
            isOneToOne: false
            referencedRelation: 'user_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      projects: {
        Row: {
          id: string
          workspace_id: string
          name: string
          description: string
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          name: string
          description?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          name?: string
          description?: string
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'projects_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'projects_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      tasks: {
        Row: {
          id: string
          project_id: string
          workspace_id: string
          title: string
          description: string
          status: string
          priority: string
          type: string
          assignee_id: string | null
          due_date: string | null
          created_by: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          project_id: string
          // Set by the tasks_sync_workspace trigger — never send it.
          workspace_id?: string
          title: string
          description?: string
          status?: string
          priority?: string
          type?: string
          assignee_id?: string | null
          due_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          project_id?: string
          workspace_id?: string
          title?: string
          description?: string
          status?: string
          priority?: string
          type?: string
          assignee_id?: string | null
          due_date?: string | null
          created_by?: string | null
          created_at?: string
          updated_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'tasks_project_id_fkey'
            columns: ['project_id']
            isOneToOne: false
            referencedRelation: 'projects'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_assignee_id_fkey'
            columns: ['assignee_id']
            isOneToOne: false
            referencedRelation: 'user_profiles'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'tasks_created_by_fkey'
            columns: ['created_by']
            isOneToOne: false
            referencedRelation: 'user_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      workspace_invitations: {
        Row: {
          id: string
          workspace_id: string
          email: string
          role: string
          invited_by: string | null
          status: string
          created_at: string
        }
        Insert: {
          id?: string
          workspace_id: string
          email: string
          role?: string
          invited_by?: string | null
          status?: string
          created_at?: string
        }
        Update: {
          id?: string
          workspace_id?: string
          email?: string
          role?: string
          invited_by?: string | null
          status?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'workspace_invitations_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'workspace_invitations_invited_by_fkey'
            columns: ['invited_by']
            isOneToOne: false
            referencedRelation: 'user_profiles'
            referencedColumns: ['id']
          }
        ]
      }
      task_checklist_items: {
        Row: {
          id: string
          task_id: string
          workspace_id: string
          content: string
          is_done: boolean
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          // Set by the task_checklist_items_sync_workspace trigger — never send it.
          workspace_id?: string
          content: string
          is_done?: boolean
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          workspace_id?: string
          content?: string
          is_done?: boolean
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_checklist_items_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_checklist_items_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          }
        ]
      }
      task_comments: {
        Row: {
          id: string
          task_id: string
          workspace_id: string
          author_id: string
          body: string
          created_at: string
        }
        Insert: {
          id?: string
          task_id: string
          // Set by the task_comments_sync_workspace trigger — never send it.
          workspace_id?: string
          author_id: string
          body: string
          created_at?: string
        }
        Update: {
          id?: string
          task_id?: string
          workspace_id?: string
          author_id?: string
          body?: string
          created_at?: string
        }
        Relationships: [
          {
            foreignKeyName: 'task_comments_task_id_fkey'
            columns: ['task_id']
            isOneToOne: false
            referencedRelation: 'tasks'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_comments_workspace_id_fkey'
            columns: ['workspace_id']
            isOneToOne: false
            referencedRelation: 'workspaces'
            referencedColumns: ['id']
          },
          {
            foreignKeyName: 'task_comments_author_id_fkey'
            columns: ['author_id']
            isOneToOne: false
            referencedRelation: 'user_profiles'
            referencedColumns: ['id']
          }
        ]
      }
    }
    Views: Record<string, never>
    Functions: {
      create_workspace: {
        Args: { workspace_name: string }
        Returns: string
      }
      workspace_role: {
        Args: { ws_id: string }
        Returns: string | null
      }
      my_invitations: {
        Args: Record<string, never>
        Returns: {
          id: string
          workspace_id: string
          workspace_name: string
          role: string
          created_at: string
        }[]
      }
      accept_invitation: {
        Args: { invitation_id: string }
        Returns: string
      }
      decline_invitation: {
        Args: { invitation_id: string }
        Returns: undefined
      }
      can_edit_task: {
        Args: { t_id: string }
        Returns: boolean
      }
    }
    Enums: Record<string, never>
    CompositeTypes: Record<string, never>
  }
}
