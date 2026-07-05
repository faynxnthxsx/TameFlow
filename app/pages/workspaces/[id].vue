<script setup lang="ts">
import type { WorkspaceRole } from '~/utils/permissions'

const route = useRoute()
const { t, locale } = useI18n()
const supabase = useSupabaseClient()

const workspaceId = route.params.id as string

const { data, pending, error, refresh } = await useAsyncData(
  `workspace-${workspaceId}`,
  async () => {
    const [wsRes, membersRes, projectsRes, invitesRes, roleRes, authRes] = await Promise.all([
      supabase
        .from('workspaces')
        .select('id, name, created_at')
        .eq('id', workspaceId)
        .single(),
      supabase
        .from('workspace_members')
        .select('user_id, role, created_at, profile:user_profiles (display_name, avatar_url)')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }),
      supabase
        .from('projects')
        .select('id, name, created_at')
        .eq('workspace_id', workspaceId)
        .order('created_at', { ascending: true }),
      supabase
        .from('workspace_invitations')
        .select('id, email, role, created_at')
        .eq('workspace_id', workspaceId)
        .eq('status', 'pending')
        .order('created_at', { ascending: true }),
      // My role from the JWT (auth.uid()) — reliable even when the reactive
      // useSupabaseUser() ref hasn't populated yet.
      supabase.rpc('workspace_role', { ws_id: workspaceId }),
      // The authenticated user id straight from the session, for the (You)
      // marker — again independent of the reactive user ref.
      supabase.auth.getUser()
    ])
    if (wsRes.error) throw wsRes.error
    if (membersRes.error) throw membersRes.error
    if (projectsRes.error) throw projectsRes.error
    if (roleRes.error) throw roleRes.error
    // Invitations are visible only to managers; non-managers get an empty list
    // from RLS rather than an error, so a failure here shouldn't break the page.
    return {
      workspace: wsRes.data,
      members: membersRes.data,
      projects: projectsRes.data,
      invitations: invitesRes.data ?? [],
      myRole: (roleRes.data ?? null) as WorkspaceRole | null,
      myUserId: authRes.data.user?.id ?? null
    }
  },
  { lazy: true }
)

const capabilities = computed(() =>
  data.value?.myRole ? resolveCapabilities(data.value.myRole) : null
)

const showProjectForm = ref(false)
const projectName = ref('')
const projectDescription = ref('')
const projectNameInput = ref<HTMLInputElement | null>(null)
const creatingProject = ref(false)
const projectError = ref('')

function openProjectForm() {
  showProjectForm.value = true
  nextTick(() => projectNameInput.value?.focus())
}

function cancelProjectForm() {
  showProjectForm.value = false
  projectName.value = ''
  projectDescription.value = ''
  projectError.value = ''
}

async function createProject() {
  const name = projectName.value.trim()
  if (!name) return
  creatingProject.value = true
  projectError.value = ''
  const { data: created, error: insertError } = await supabase
    .from('projects')
    .insert({
      workspace_id: workspaceId,
      name,
      description: projectDescription.value.trim(),
      created_by: data.value?.myUserId
    })
    .select('id')
    .single()
  creatingProject.value = false
  if (insertError || !created) {
    projectError.value = t('error.generic')
    return
  }
  cancelProjectForm()
  await refresh()
  await navigateTo(`/projects/${created.id}`)
}

// --- invitations ---
const INVITABLE_ROLES = ['admin', 'member', 'viewer'] as const
const showInviteForm = ref(false)
const inviteEmail = ref('')
const inviteRole = ref<(typeof INVITABLE_ROLES)[number]>('member')
const inviteEmailInput = ref<HTMLInputElement | null>(null)
const inviting = ref(false)
const inviteError = ref('')

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function openInviteForm() {
  showInviteForm.value = true
  nextTick(() => inviteEmailInput.value?.focus())
}

function cancelInviteForm() {
  showInviteForm.value = false
  inviteEmail.value = ''
  inviteRole.value = 'member'
  inviteError.value = ''
}

async function sendInvite() {
  const email = inviteEmail.value.trim().toLowerCase()
  if (!EMAIL_RE.test(email)) {
    inviteError.value = t('validation.email')
    return
  }
  inviting.value = true
  inviteError.value = ''
  const { error: insertError } = await supabase.from('workspace_invitations').insert({
    workspace_id: workspaceId,
    email,
    role: inviteRole.value,
    invited_by: data.value?.myUserId
  })
  inviting.value = false
  if (insertError) {
    // 23505 = unique violation → a pending invite for this email already exists.
    inviteError.value =
      insertError.code === '23505' ? t('invite.duplicate') : t('error.generic')
    return
  }
  cancelInviteForm()
  await refresh()
}

async function cancelInvite(id: string) {
  const { error: deleteError } = await supabase
    .from('workspace_invitations')
    .delete()
    .eq('id', id)
  if (!deleteError) await refresh()
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value)
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
    <p v-if="pending" class="text-text-muted">{{ t('common.loading') }}</p>

    <template v-else-if="error || !data">
      <p class="rounded-2xl border border-border bg-surface p-8 text-center text-text-muted">
        {{ t('error.notFound') }}
      </p>
      <NuxtLink to="/workspaces" class="mt-4 block text-center text-sm font-medium text-primary hover:underline">
        {{ t('common.back') }}
      </NuxtLink>
    </template>

    <template v-else>
      <div class="flex items-center justify-between">
        <div>
          <NuxtLink to="/workspaces" class="text-sm text-text-muted hover:text-text">
            &larr; {{ t('nav.workspaces') }}
          </NuxtLink>
          <h1 class="mt-1 text-2xl font-bold text-text">{{ data.workspace.name }}</h1>
          <p class="mt-1 text-sm text-text-muted">
            {{ t('workspace.createdAt') }} {{ formatDate(data.workspace.created_at) }}
          </p>
        </div>
      </div>

      <div class="mt-8 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-text">
          {{ t('project.sectionTitle') }} ({{ data.projects.length }})
        </h2>
        <button
          v-if="capabilities?.manageProjects && !showProjectForm"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover"
          @click="openProjectForm"
        >
          <AppIcon name="plus" class="h-4 w-4" />
          {{ t('project.create') }}
        </button>
      </div>

      <form
        v-if="showProjectForm"
        class="mt-3 flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card"
        @submit.prevent="createProject"
      >
        <input
          ref="projectNameInput"
          v-model="projectName"
          type="text"
          maxlength="80"
          :placeholder="t('project.namePlaceholder')"
          class="rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <textarea
          v-model="projectDescription"
          rows="3"
          maxlength="500"
          :placeholder="t('project.descriptionPlaceholder')"
          class="resize-y rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
        <div class="flex gap-3">
          <button
            type="submit"
            :disabled="creatingProject || !projectName.trim()"
            class="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-60"
          >
            {{ creatingProject ? t('common.loading') : t('project.create') }}
          </button>
          <button
            type="button"
            class="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted hover:text-text"
            @click="cancelProjectForm"
          >
            {{ t('common.cancel') }}
          </button>
        </div>
      </form>
      <p v-if="projectError" class="mt-2 text-sm text-danger">{{ projectError }}</p>

      <p
        v-if="data.projects.length === 0"
        class="mt-3 rounded-2xl border border-dashed border-border p-8 text-center text-text-muted"
      >
        {{ t('project.empty') }}
      </p>
      <div v-else class="mt-3 flex flex-col gap-2">
        <NuxtLink
          v-for="project in data.projects"
          :key="project.id"
          :to="`/projects/${project.id}`"
          class="flex items-center gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card transition hover:border-primary hover:shadow-md"
        >
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <AppIcon name="projects" class="h-5 w-5" />
          </span>
          <p class="min-w-0 flex-1 truncate font-semibold text-text">{{ project.name }}</p>
          <p class="shrink-0 text-sm text-text-muted">
            {{ t('workspace.createdAt') }} {{ formatDate(project.created_at) }}
          </p>
        </NuxtLink>
      </div>

      <h2 class="mt-8 text-lg font-semibold text-text">
        {{ t('workspace.members') }} ({{ data.members.length }})
      </h2>

      <ul class="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface shadow-card">
        <li
          v-for="member in data.members"
          :key="member.user_id"
          class="flex items-center justify-between p-4"
        >
          <div class="flex items-center gap-3">
            <img
              v-if="member.profile?.avatar_url"
              :src="member.profile.avatar_url"
              alt=""
              class="h-9 w-9 rounded-full"
            />
            <div
              v-else
              class="flex h-9 w-9 items-center justify-center rounded-full bg-surface-alt text-sm font-medium text-text-muted"
            >
              {{ (member.profile?.display_name ?? '?').charAt(0).toUpperCase() }}
            </div>
            <div>
              <p class="font-medium text-text">
                {{ member.profile?.display_name ?? '—' }}
                <span v-if="member.user_id === data.myUserId" class="text-sm text-text-muted">
                  ({{ t('workspace.you') }})
                </span>
              </p>
              <p class="text-sm text-text-muted">
                {{ t('workspace.joinedAt') }} {{ formatDate(member.created_at) }}
              </p>
            </div>
          </div>
          <span
            class="rounded-full px-3 py-1 text-xs font-medium"
            :class="ROLE_BADGE_CLASSES[member.role]"
          >
            {{ t(`role.${member.role}`) }}
          </span>
        </li>
      </ul>

      <template v-if="capabilities?.manageMembers">
        <div class="mt-8 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-text">
            {{ t('invite.sectionTitle') }} ({{ data.invitations.length }})
          </h2>
          <button
            v-if="!showInviteForm"
            type="button"
            class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3 py-1.5 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover"
            @click="openInviteForm"
          >
            <AppIcon name="plus" class="h-4 w-4" />
            {{ t('invite.send') }}
          </button>
        </div>

        <form
          v-if="showInviteForm"
          class="mt-3 flex flex-wrap gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card"
          @submit.prevent="sendInvite"
        >
          <input
            ref="inviteEmailInput"
            v-model="inviteEmail"
            type="email"
            :placeholder="t('invite.emailPlaceholder')"
            class="min-w-[12rem] flex-1 rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <select
            v-model="inviteRole"
            class="rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          >
            <option v-for="r in INVITABLE_ROLES" :key="r" :value="r">
              {{ t(`role.${r}`) }}
            </option>
          </select>
          <button
            type="submit"
            :disabled="inviting || !inviteEmail.trim()"
            class="rounded-xl bg-primary px-4 py-2 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-60"
          >
            {{ inviting ? t('common.loading') : t('invite.send') }}
          </button>
          <button
            type="button"
            class="rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted hover:text-text"
            @click="cancelInviteForm"
          >
            {{ t('common.cancel') }}
          </button>
        </form>
        <p v-if="inviteError" class="mt-2 text-sm text-danger">{{ inviteError }}</p>

        <p
          v-if="data.invitations.length === 0"
          class="mt-3 rounded-2xl border border-dashed border-border p-8 text-center text-text-muted"
        >
          {{ t('invite.empty') }}
        </p>
        <ul
          v-else
          class="mt-3 divide-y divide-border rounded-2xl border border-border bg-surface shadow-card"
        >
          <li
            v-for="invite in data.invitations"
            :key="invite.id"
            class="flex items-center justify-between gap-3 p-4"
          >
            <div>
              <p class="font-medium text-text">{{ invite.email }}</p>
              <p class="text-sm text-text-muted">
                {{ t('invite.pendingSince') }} {{ formatDate(invite.created_at) }}
              </p>
            </div>
            <div class="flex items-center gap-3">
              <span
                class="rounded-full px-3 py-1 text-xs font-medium"
                :class="ROLE_BADGE_CLASSES[invite.role]"
              >
                {{ t(`role.${invite.role}`) }}
              </span>
              <button
                type="button"
                class="text-sm text-text-muted hover:text-danger"
                @click="cancelInvite(invite.id)"
              >
                {{ t('invite.cancel') }}
              </button>
            </div>
          </li>
        </ul>
      </template>
    </template>
  </div>
</template>
