<script setup lang="ts">
import type { WorkspaceRole } from '~/utils/permissions'

const { t } = useI18n()
const supabase = useSupabaseClient()

const ASSIGNABLE_ROLES = ['admin', 'member', 'viewer'] as const

interface MemberRow {
  workspace_id: string
  user_id: string
  role: WorkspaceRole
  workspace: { name: string } | null
  profile: { display_name: string | null; avatar_url: string | null } | null
}

const { data, pending, refresh } = await useAsyncData(
  'all-members',
  async () => {
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id ?? null
    const { data: rows } = await supabase
      .from('workspace_members')
      .select(
        'workspace_id, user_id, role, workspace:workspaces (name), profile:user_profiles (display_name, avatar_url)'
      )
      .order('created_at', { ascending: true })

    // My role per workspace, to know where I can manage.
    const myRole = new Map<string, WorkspaceRole>()
    for (const r of (rows ?? []) as MemberRow[]) {
      if (r.user_id === uid) myRole.set(r.workspace_id, r.role)
    }

    // Group rows by workspace.
    const byWs = new Map<
      string,
      { workspaceId: string; workspaceName: string; myRole: WorkspaceRole | null; members: MemberRow[] }
    >()
    for (const r of (rows ?? []) as MemberRow[]) {
      const g = byWs.get(r.workspace_id) ?? {
        workspaceId: r.workspace_id,
        workspaceName: r.workspace?.name ?? '—',
        myRole: myRole.get(r.workspace_id) ?? null,
        members: []
      }
      g.members.push(r)
      byWs.set(r.workspace_id, g)
    }

    return { uid, groups: [...byWs.values()] }
  },
  { lazy: true }
)

function canManage(role: WorkspaceRole | null) {
  return role === 'owner' || role === 'admin'
}

async function changeRole(m: MemberRow, role: string) {
  const { error } = await supabase
    .from('workspace_members')
    .update({ role })
    .eq('workspace_id', m.workspace_id)
    .eq('user_id', m.user_id)
  if (!error) await refresh()
}

async function removeMember(m: MemberRow, workspaceName: string) {
  const name = m.profile?.display_name ?? '—'
  if (!window.confirm(t('members.removeConfirm', { name, workspace: workspaceName }))) return
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', m.workspace_id)
    .eq('user_id', m.user_id)
  if (!error) await refresh()
}

const ROLE_BADGE_CLASSES: Record<string, string> = {
  owner: 'bg-primary text-primary-fg',
  admin: 'bg-info text-text-inverse',
  member: 'bg-surface-alt text-text',
  viewer: 'bg-surface-alt text-text-muted'
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <h1 class="text-2xl font-bold text-text">{{ t('nav.members') }}</h1>

    <p v-if="pending" class="mt-6 text-text-muted">{{ t('common.loading') }}</p>
    <p
      v-else-if="!data || data.groups.length === 0"
      class="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-text-muted"
    >
      {{ t('members.empty') }}
    </p>

    <div v-else class="mt-6 space-y-6">
      <section
        v-for="group in data.groups"
        :key="group.workspaceId"
        class="rounded-2xl border border-border bg-surface shadow-card"
      >
        <div class="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
          <NuxtLink
            :to="`/workspaces/${group.workspaceId}`"
            class="font-semibold text-text hover:text-primary"
          >
            {{ group.workspaceName }}
          </NuxtLink>
          <span v-if="canManage(group.myRole)" class="text-xs text-text-muted">
            {{ t('members.managed') }}
          </span>
        </div>

        <ul class="divide-y divide-border">
          <li
            v-for="m in group.members"
            :key="m.user_id"
            class="flex items-center justify-between gap-3 px-5 py-3"
          >
            <div class="flex min-w-0 items-center gap-3">
              <img
                v-if="m.profile?.avatar_url"
                :src="m.profile.avatar_url"
                alt=""
                class="h-9 w-9 rounded-full object-cover"
              />
              <div
                v-else
                class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-surface-alt text-sm font-medium text-text-muted"
              >
                {{ (m.profile?.display_name ?? '?').charAt(0).toUpperCase() }}
              </div>
              <p class="truncate font-medium text-text">
                {{ m.profile?.display_name ?? '—' }}
                <span v-if="m.user_id === data.uid" class="text-sm text-text-muted">
                  ({{ t('workspace.you') }})
                </span>
              </p>
            </div>

            <!-- Managers can change/remove any non-owner member. -->
            <div
              v-if="canManage(group.myRole) && m.role !== 'owner'"
              class="flex shrink-0 items-center gap-2"
            >
              <select
                :value="m.role"
                class="rounded-lg border border-border bg-surface px-2 py-1 text-xs text-text focus:border-primary focus:outline-none"
                @change="changeRole(m, ($event.target as HTMLSelectElement).value)"
              >
                <option v-for="r in ASSIGNABLE_ROLES" :key="r" :value="r">
                  {{ t(`role.${r}`) }}
                </option>
              </select>
              <button
                type="button"
                class="text-text-muted transition hover:text-danger"
                :aria-label="t('members.remove')"
                @click="removeMember(m, group.workspaceName)"
              >
                <AppIcon name="trash" class="h-4 w-4" />
              </button>
            </div>
            <span
              v-else
              class="shrink-0 rounded-full px-3 py-1 text-xs font-medium"
              :class="ROLE_BADGE_CLASSES[m.role]"
            >
              {{ t(`role.${m.role}`) }}
            </span>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
