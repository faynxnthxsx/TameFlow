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

const totals = computed(() => ({
  teams: data.value?.groups.length ?? 0,
  members: data.value?.groups.reduce((n, g) => n + g.members.length, 0) ?? 0
}))

const roleOptions = computed(() =>
  ASSIGNABLE_ROLES.map((r) => ({ value: r, label: t(`role.${r}`) }))
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

// --- remove member (confirmation modal) ---
const memberToRemove = ref<{ m: MemberRow; workspaceName: string } | null>(null)
const removing = ref(false)

function askRemove(m: MemberRow, workspaceName: string) {
  memberToRemove.value = { m, workspaceName }
}
async function confirmRemove() {
  const target = memberToRemove.value
  if (!target) return
  removing.value = true
  const { error } = await supabase
    .from('workspace_members')
    .delete()
    .eq('workspace_id', target.m.workspace_id)
    .eq('user_id', target.m.user_id)
  removing.value = false
  if (!error) {
    memberToRemove.value = null
    await refresh()
  }
}

function initials(name: string | null | undefined) {
  return (name ?? '?').charAt(0).toUpperCase()
}

const ROLE_BADGE_CLASSES: Record<string, string> = {
  owner: 'bg-primary/10 text-primary',
  admin: 'bg-info/10 text-info',
  member: 'bg-surface-alt text-text',
  viewer: 'bg-surface-alt text-text-muted'
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <div class="flex flex-wrap items-start justify-between gap-4">
      <div>
        <h1 class="text-2xl font-bold text-text">{{ t('nav.members') }}</h1>
        <p class="mt-1 text-sm text-text-muted">{{ t('members.subtitle') }}</p>
      </div>
      <div v-if="data && data.groups.length" class="flex gap-3">
        <div class="rounded-xl border border-border bg-surface px-4 py-2 text-center shadow-card">
          <p class="text-lg font-bold text-text">{{ totals.teams }}</p>
          <p class="text-xs text-text-muted">{{ t('members.totalTeams') }}</p>
        </div>
        <div class="rounded-xl border border-border bg-surface px-4 py-2 text-center shadow-card">
          <p class="text-lg font-bold text-text">{{ totals.members }}</p>
          <p class="text-xs text-text-muted">{{ t('members.totalMembers') }}</p>
        </div>
      </div>
    </div>

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
        class="overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
      >
        <div class="flex items-center justify-between gap-2 border-b border-border px-5 py-3">
          <NuxtLink
            :to="`/workspaces/${group.workspaceId}`"
            class="flex items-center gap-2 font-semibold text-text transition hover:text-primary"
          >
            <AppIcon name="workspace" class="h-4 w-4 text-text-muted" />
            {{ group.workspaceName }}
            <span class="rounded-full bg-surface-alt px-2 py-0.5 text-xs font-medium text-text-muted">
              {{ group.members.length }}
            </span>
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
                class="h-9 w-9 rounded-full object-cover ring-2 ring-surface"
              />
              <span
                v-else
                class="grid h-9 w-9 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary ring-2 ring-surface"
              >
                {{ initials(m.profile?.display_name) }}
              </span>
              <p class="truncate font-medium text-text">
                {{ m.profile?.display_name ?? '—' }}
                <span v-if="m.user_id === data.uid" class="text-sm font-normal text-text-muted">
                  ({{ t('workspace.you') }})
                </span>
              </p>
            </div>

            <!-- Managers can change/remove any non-owner member. -->
            <div
              v-if="canManage(group.myRole) && m.role !== 'owner'"
              class="flex shrink-0 items-center gap-2"
            >
              <div class="w-32">
                <AppSelect
                  :model-value="m.role"
                  :options="roleOptions"
                  @update:model-value="changeRole(m, $event)"
                />
              </div>
              <button
                type="button"
                class="grid h-9 w-9 place-items-center rounded-lg text-text-muted transition hover:bg-danger/10 hover:text-danger"
                :aria-label="t('members.remove')"
                @click="askRemove(m, group.workspaceName)"
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

    <!-- Remove member confirmation -->
    <Teleport to="body">
      <div v-if="memberToRemove" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-text/50 backdrop-blur-sm" @click="memberToRemove = null" />
        <div class="relative w-full max-w-sm rounded-2xl bg-surface p-6 text-center shadow-modal">
          <span class="mx-auto grid h-14 w-14 place-items-center rounded-full bg-danger/10 text-danger">
            <AppIcon name="trash" class="h-6 w-6" />
          </span>
          <h2 class="mt-4 text-lg font-bold text-text">{{ t('members.removeTitle') }}</h2>
          <p class="mt-2 text-sm text-text-muted">
            {{ t('members.removeConfirm', {
              name: memberToRemove.m.profile?.display_name ?? '—',
              workspace: memberToRemove.workspaceName
            }) }}
          </p>
          <div class="mt-6 flex justify-center gap-3">
            <button
              type="button"
              class="flex-1 rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-muted transition hover:text-text"
              @click="memberToRemove = null"
            >
              {{ t('common.cancel') }}
            </button>
            <button
              type="button"
              :disabled="removing"
              class="inline-flex flex-1 items-center justify-center gap-1.5 rounded-xl bg-danger px-4 py-2.5 text-sm font-medium text-primary-fg shadow-sm transition hover:opacity-90 disabled:opacity-60"
              @click="confirmRemove"
            >
              <AppIcon name="trash" class="h-4 w-4" />
              {{ removing ? t('common.loading') : t('members.remove') }}
            </button>
          </div>
        </div>
      </div>
    </Teleport>
  </div>
</template>
