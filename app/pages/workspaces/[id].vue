<script setup lang="ts">
import type { WorkspaceRole } from '~/utils/permissions'

const route = useRoute()
const { t, locale } = useI18n()
const supabase = useSupabaseClient()

const workspaceId = route.params.id as string

const { data, pending, error, refresh } = await useAsyncData(
  `workspace-${workspaceId}`,
  async () => {
    const [
      wsRes,
      membersRes,
      projectsRes,
      invitesRes,
      roleRes,
      authRes,
      taskCountRes,
      doneCountRes
    ] = await Promise.all([
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
        .select('id, name, description, created_at')
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
      supabase.auth.getUser(),
      // Task totals power the hero stats strip; head:true skips the row bodies.
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId),
      supabase
        .from('tasks')
        .select('id', { count: 'exact', head: true })
        .eq('workspace_id', workspaceId)
        .eq('status', 'done')
    ])
    if (wsRes.error) throw wsRes.error
    if (membersRes.error) throw membersRes.error
    if (projectsRes.error) throw projectsRes.error
    if (roleRes.error) throw roleRes.error
    // Invitations are visible only to managers; non-managers get an empty list
    // from RLS rather than an error, so a failure here shouldn't break the page.
    const taskCount = taskCountRes.count ?? 0
    const doneCount = doneCountRes.count ?? 0
    return {
      workspace: wsRes.data,
      members: membersRes.data,
      projects: projectsRes.data,
      invitations: invitesRes.data ?? [],
      myRole: (roleRes.data ?? null) as WorkspaceRole | null,
      myUserId: authRes.data.user?.id ?? null,
      taskCount,
      doneCount,
      progress: taskCount ? Math.round((doneCount / taskCount) * 100) : 0
    }
  },
  { lazy: true }
)

const capabilities = computed(() =>
  data.value?.myRole ? resolveCapabilities(data.value.myRole) : null
)

// --- create project ---
const showProjectForm = ref(false)
const projectName = ref('')
const projectDescription = ref('')
const projectNameInput = ref<HTMLInputElement | null>(null)
const creatingProject = ref(false)
const projectError = ref('')

function openProjectForm() {
  showProjectForm.value = true
  projectError.value = ''
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

// After an invite is created we swap the modal to a "share" step so the inviter
// can send the link out (social / copy) instead of relying on email delivery.
const inviteShare = ref<{ email: string; url: string; message: string } | null>(null)
const copied = ref(false)

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function openInviteForm() {
  showInviteForm.value = true
  inviteError.value = ''
  inviteShare.value = null
  nextTick(() => inviteEmailInput.value?.focus())
}

function cancelInviteForm() {
  showInviteForm.value = false
  inviteEmail.value = ''
  inviteRole.value = 'member'
  inviteError.value = ''
  inviteShare.value = null
  copied.value = false
}

// Social share targets (opened in a new tab). IG has no web link-share, so it's
// covered by "copy message" which the user can paste anywhere.
const shareLinks = computed(() => {
  const s = inviteShare.value
  if (!s) return []
  const u = encodeURIComponent(s.url)
  const txt = encodeURIComponent(s.message)
  return [
    { key: 'Facebook', color: '#1877F2', href: `https://www.facebook.com/sharer/sharer.php?u=${u}` },
    { key: 'X', color: '#000000', href: `https://twitter.com/intent/tweet?text=${txt}` },
    { key: 'LINE', color: '#06C755', href: `https://social-plugins.line.me/lineit/share?url=${u}` },
    { key: 'WhatsApp', color: '#25D366', href: `https://wa.me/?text=${txt}` }
  ]
})

async function copyShare() {
  if (!inviteShare.value) return
  try {
    await navigator.clipboard.writeText(inviteShare.value.message)
    copied.value = true
    setTimeout(() => (copied.value = false), 2000)
  } catch {
    // Clipboard may be blocked; the message is still selectable in the field.
  }
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
  // Build the shareable message and switch the modal to the share step.
  const url = `${window.location.origin}/invitations`
  inviteShare.value = {
    email,
    url,
    message: t('invite.shareMessage', {
      workspace: data.value?.workspace.name ?? '',
      email,
      url
    })
  }
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

// Subtle role chips, matching the workspace list cards.
const ROLE_BADGE_CLASSES: Record<string, string> = {
  owner: 'bg-primary/10 text-primary',
  admin: 'bg-info/10 text-info',
  member: 'bg-surface-alt text-text',
  viewer: 'bg-surface-alt text-text-muted'
}

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  const first = parts[0]?.[0] ?? ''
  const second = parts.length > 1 ? parts[1][0] : (parts[0]?.[1] ?? '')
  return (first + second).toUpperCase() || 'WS'
}
</script>

<template>
  <div class="mx-auto max-w-5xl">
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
      <NuxtLink
        to="/workspaces"
        class="inline-flex items-center gap-1.5 text-sm font-medium text-text-muted transition hover:text-text"
      >
        <AppIcon name="chevron-left" class="h-4 w-4" />
        {{ t('nav.workspaces') }}
      </NuxtLink>

      <!-- Hero — solid blue band -->
      <div class="mt-3 overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <div class="h-20 bg-primary sm:h-24" />
        <div class="px-6 pb-6 pt-4">
          <div class="flex flex-wrap items-center gap-4">
            <span
              class="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-primary text-xl font-bold text-primary-fg shadow-sm ring-4 ring-surface"
            >
              {{ initials(data.workspace.name) }}
            </span>
            <div class="min-w-0 flex-1">
              <div class="flex flex-wrap items-center gap-2.5">
                <h1 class="truncate text-2xl font-bold text-text">{{ data.workspace.name }}</h1>
                <span
                  v-if="data.myRole"
                  class="shrink-0 rounded-full px-2.5 py-0.5 text-xs font-medium"
                  :class="ROLE_BADGE_CLASSES[data.myRole]"
                >
                  {{ t(`role.${data.myRole}`) }}
                </span>
              </div>
              <p class="mt-1 text-sm text-text-muted">
                {{ t('workspace.createdAt') }} {{ formatDate(data.workspace.created_at) }}
              </p>
            </div>
          </div>

          <!-- Stats strip -->
          <div class="mt-6 grid grid-cols-2 gap-4 border-t border-border pt-5 sm:grid-cols-4">
            <div class="flex flex-col gap-0.5">
              <span class="flex items-center gap-1.5 text-lg font-bold text-text">
                <AppIcon name="members" class="h-4 w-4 text-text-muted" />{{ data.members.length }}
              </span>
              <span class="text-xs text-text-muted">{{ t('workspace.members') }}</span>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="flex items-center gap-1.5 text-lg font-bold text-text">
                <AppIcon name="projects" class="h-4 w-4 text-text-muted" />{{ data.projects.length }}
              </span>
              <span class="text-xs text-text-muted">{{ t('workspace.projects') }}</span>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="flex items-center gap-1.5 text-lg font-bold text-text">
                <AppIcon name="tasks" class="h-4 w-4 text-text-muted" />{{ data.taskCount }}
              </span>
              <span class="text-xs text-text-muted">{{ t('workspace.tasks') }}</span>
            </div>
            <div class="flex flex-col gap-0.5">
              <span class="flex items-center gap-1.5 text-lg font-bold text-text">
                <span
                  class="h-4 w-4 rounded-full"
                  :style="{ background: `conic-gradient(var(--tf-color-primary) ${data.progress}%, var(--tf-color-border) 0)` }"
                />{{ data.progress }}%
              </span>
              <span class="text-xs text-text-muted">{{ t('workspace.progress') }}</span>
            </div>
          </div>
        </div>
      </div>

      <!-- Projects -->
      <div class="mt-8 flex items-center justify-between">
        <h2 class="text-lg font-semibold text-text">
          {{ t('project.sectionTitle') }}
          <span class="ml-1 text-text-muted">({{ data.projects.length }})</span>
        </h2>
        <button
          v-if="capabilities?.manageProjects"
          type="button"
          class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover"
          @click="openProjectForm"
        >
          <AppIcon name="plus" class="h-4 w-4" />
          {{ t('project.create') }}
        </button>
      </div>

      <div class="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
        <NuxtLink
          v-for="project in data.projects"
          :key="project.id"
          :to="`/projects/${project.id}`"
          class="group flex flex-col gap-3 rounded-2xl border border-border bg-surface p-4 shadow-card transition hover:-translate-y-0.5 hover:border-primary hover:shadow-md"
        >
          <div class="flex items-center gap-3">
            <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
              <AppIcon name="projects" class="h-5 w-5" />
            </span>
            <p class="min-w-0 flex-1 truncate font-semibold text-text">{{ project.name }}</p>
            <AppIcon
              name="chevron-right"
              class="h-4 w-4 shrink-0 text-text-muted transition group-hover:translate-x-0.5 group-hover:text-primary"
            />
          </div>
          <p v-if="project.description" class="line-clamp-2 text-sm text-text-muted">
            {{ project.description }}
          </p>
          <p class="mt-auto text-xs text-text-muted">
            {{ t('workspace.createdAt') }} {{ formatDate(project.created_at) }}
          </p>
        </NuxtLink>

        <!-- Empty state -->
        <p
          v-if="data.projects.length === 0"
          class="rounded-2xl border border-dashed border-border p-8 text-center text-text-muted sm:col-span-2"
        >
          {{ t('project.empty') }}
        </p>
      </div>

      <!-- Members -->
      <h2 class="mt-8 text-lg font-semibold text-text">
        {{ t('workspace.members') }}
        <span class="ml-1 text-text-muted">({{ data.members.length }})</span>
      </h2>

      <ul class="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <li
          v-for="member in data.members"
          :key="member.user_id"
          class="flex items-center justify-between p-4 transition hover:bg-surface-alt/50"
        >
          <div class="flex min-w-0 items-center gap-3">
            <img
              v-if="member.profile?.avatar_url"
              :src="member.profile.avatar_url"
              alt=""
              class="h-10 w-10 shrink-0 rounded-full object-cover ring-2 ring-surface"
            />
            <span
              v-else
              class="grid h-10 w-10 shrink-0 place-items-center rounded-full bg-primary/15 text-sm font-semibold text-primary ring-2 ring-surface"
            >
              {{ (member.profile?.display_name ?? '?').charAt(0).toUpperCase() }}
            </span>
            <div class="min-w-0">
              <p class="truncate font-medium text-text">
                {{ member.profile?.display_name ?? '—' }}
                <span v-if="member.user_id === data.myUserId" class="text-sm font-normal text-text-muted">
                  ({{ t('workspace.you') }})
                </span>
              </p>
              <p class="text-sm text-text-muted">
                {{ t('workspace.joinedAt') }} {{ formatDate(member.created_at) }}
              </p>
            </div>
          </div>
          <span
            class="shrink-0 rounded-full px-3 py-1 text-xs font-medium"
            :class="ROLE_BADGE_CLASSES[member.role]"
          >
            {{ t(`role.${member.role}`) }}
          </span>
        </li>
      </ul>

      <!-- Pending invitations (managers only) -->
      <template v-if="capabilities?.manageMembers">
        <div class="mt-8 flex items-center justify-between">
          <h2 class="text-lg font-semibold text-text">
            {{ t('invite.sectionTitle') }}
            <span class="ml-1 text-text-muted">({{ data.invitations.length }})</span>
          </h2>
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-3.5 py-2 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover"
            @click="openInviteForm"
          >
            <AppIcon name="user-plus" class="h-4 w-4" />
            {{ t('invite.send') }}
          </button>
        </div>

        <p
          v-if="data.invitations.length === 0"
          class="mt-4 flex flex-col items-center gap-1 rounded-2xl border border-dashed border-border p-8 text-center text-sm text-text-muted"
        >
          <AppIcon name="mail" class="mb-1 h-6 w-6 text-text-muted/60" />
          {{ t('invite.empty') }}
        </p>
        <ul
          v-else
          class="mt-4 divide-y divide-border overflow-hidden rounded-2xl border border-border bg-surface shadow-card"
        >
          <li
            v-for="invite in data.invitations"
            :key="invite.id"
            class="flex items-center justify-between gap-3 p-4"
          >
            <div class="flex min-w-0 items-center gap-3">
              <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                <AppIcon name="mail" class="h-5 w-5" />
              </span>
              <div class="min-w-0">
                <p class="truncate font-medium text-text">{{ invite.email }}</p>
                <p class="text-sm text-text-muted">
                  {{ t('invite.pendingSince') }} {{ formatDate(invite.created_at) }}
                </p>
              </div>
            </div>
            <div class="flex shrink-0 items-center gap-3">
              <span
                class="rounded-full px-3 py-1 text-xs font-medium"
                :class="ROLE_BADGE_CLASSES[invite.role]"
              >
                {{ t(`role.${invite.role}`) }}
              </span>
              <button
                type="button"
                class="rounded-lg p-1.5 text-text-muted transition hover:bg-danger/10 hover:text-danger"
                :title="t('invite.cancel')"
                @click="cancelInvite(invite.id)"
              >
                <AppIcon name="trash" class="h-4 w-4" />
              </button>
            </div>
          </li>
        </ul>
      </template>
    </template>

    <!-- Create project modal -->
    <Teleport to="body">
      <div v-if="showProjectForm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-text/50 backdrop-blur-sm" @click="cancelProjectForm" />
        <div class="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-modal">
          <div class="flex items-start justify-between gap-4">
            <div class="flex items-center gap-3">
              <span class="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-brand-accent text-primary-fg">
                <AppIcon name="projects" class="h-5 w-5" />
              </span>
              <div>
                <h2 class="text-lg font-bold text-text">{{ t('project.create') }}</h2>
                <p class="text-sm text-text-muted">{{ t('project.createSubtitle') }}</p>
              </div>
            </div>
            <button
              type="button"
              class="rounded-lg p-1 text-text-muted transition hover:bg-surface-alt hover:text-text"
              @click="cancelProjectForm"
            >
              <AppIcon name="x" class="h-5 w-5" />
            </button>
          </div>

          <form class="mt-5 flex flex-col gap-4" @submit.prevent="createProject">
            <div>
              <label class="mb-1.5 block text-sm font-medium text-text">{{ t('project.namePlaceholder') }}</label>
              <input
                ref="projectNameInput"
                v-model="projectName"
                type="text"
                maxlength="80"
                :placeholder="t('project.namePlaceholder')"
                class="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                @keyup.esc="cancelProjectForm"
              />
            </div>
            <div>
              <label class="mb-1.5 block text-sm font-medium text-text">{{ t('project.descriptionPlaceholder') }}</label>
              <textarea
                v-model="projectDescription"
                rows="3"
                maxlength="500"
                :placeholder="t('project.descriptionPlaceholder')"
                class="w-full resize-y rounded-xl border border-border bg-surface px-3.5 py-2.5 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
              />
            </div>
            <p v-if="projectError" class="text-sm text-danger">{{ projectError }}</p>

            <div class="flex justify-end gap-3">
              <button
                type="button"
                class="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-muted transition hover:text-text"
                @click="cancelProjectForm"
              >
                {{ t('common.cancel') }}
              </button>
              <button
                type="submit"
                :disabled="creatingProject || !projectName.trim()"
                class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover disabled:opacity-60"
              >
                <AppIcon name="plus" class="h-4 w-4" />
                {{ creatingProject ? t('common.loading') : t('project.create') }}
              </button>
            </div>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Invite modal -->
    <Teleport to="body">
      <div v-if="showInviteForm" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-text/50 backdrop-blur-sm" @click="cancelInviteForm" />
        <div class="relative w-full max-w-md rounded-2xl bg-surface p-6 shadow-modal">
          <!-- Step 1: enter email + role -->
          <template v-if="!inviteShare">
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-3">
                <span class="grid h-11 w-11 place-items-center rounded-xl bg-gradient-to-br from-primary to-info text-primary-fg">
                  <AppIcon name="user-plus" class="h-5 w-5" />
                </span>
                <div>
                  <h2 class="text-lg font-bold text-text">{{ t('invite.sendTitle') }}</h2>
                  <p class="text-sm text-text-muted">{{ t('invite.sendSubtitle') }}</p>
                </div>
              </div>
              <button
                type="button"
                class="rounded-lg p-1 text-text-muted transition hover:bg-surface-alt hover:text-text"
                @click="cancelInviteForm"
              >
                <AppIcon name="x" class="h-5 w-5" />
              </button>
            </div>

            <form class="mt-5 flex flex-col gap-4" @submit.prevent="sendInvite">
              <div>
                <label class="mb-1.5 block text-sm font-medium text-text">{{ t('invite.emailPlaceholder') }}</label>
                <input
                  ref="inviteEmailInput"
                  v-model="inviteEmail"
                  type="email"
                  :placeholder="t('invite.emailPlaceholder')"
                  class="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                  @keyup.esc="cancelInviteForm"
                />
              </div>
              <div>
                <label class="mb-1.5 block text-sm font-medium text-text">{{ t('invite.roleLabel') }}</label>
                <select
                  v-model="inviteRole"
                  class="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
                >
                  <option v-for="r in INVITABLE_ROLES" :key="r" :value="r">
                    {{ t(`role.${r}`) }}
                  </option>
                </select>
              </div>
              <p v-if="inviteError" class="text-sm text-danger">{{ inviteError }}</p>

              <div class="flex justify-end gap-3">
                <button
                  type="button"
                  class="rounded-xl border border-border px-4 py-2.5 text-sm font-medium text-text-muted transition hover:text-text"
                  @click="cancelInviteForm"
                >
                  {{ t('common.cancel') }}
                </button>
                <button
                  type="submit"
                  :disabled="inviting || !inviteEmail.trim()"
                  class="inline-flex items-center gap-1.5 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover disabled:opacity-60"
                >
                  <AppIcon name="user-plus" class="h-4 w-4" />
                  {{ inviting ? t('common.loading') : t('invite.send') }}
                </button>
              </div>
            </form>
          </template>

          <!-- Step 2: share the invite link -->
          <template v-else>
            <div class="flex items-start justify-between gap-4">
              <div class="flex items-center gap-3">
                <span class="grid h-11 w-11 place-items-center rounded-xl bg-success/10 text-success">
                  <AppIcon name="check" class="h-5 w-5" />
                </span>
                <div>
                  <h2 class="text-lg font-bold text-text">{{ t('invite.shareTitle') }}</h2>
                  <p class="text-sm text-text-muted">{{ t('invite.shareSubtitle', { email: inviteShare.email }) }}</p>
                </div>
              </div>
              <button
                type="button"
                class="rounded-lg p-1 text-text-muted transition hover:bg-surface-alt hover:text-text"
                @click="cancelInviteForm"
              >
                <AppIcon name="x" class="h-5 w-5" />
              </button>
            </div>

            <div class="mt-5">
              <p class="rounded-xl border border-border bg-surface-alt p-3 text-sm leading-relaxed text-text-muted">
                {{ inviteShare.message }}
              </p>
              <button
                type="button"
                class="mt-3 flex w-full items-center justify-center gap-2 rounded-xl border border-border px-4 py-2.5 text-sm font-medium transition hover:bg-surface-alt"
                :class="copied ? 'text-success' : 'text-text'"
                @click="copyShare"
              >
                <AppIcon :name="copied ? 'check' : 'send'" class="h-4 w-4" />
                {{ copied ? t('invite.copied') : t('invite.copyLink') }}
              </button>

              <p class="mb-2 mt-5 text-xs font-medium uppercase tracking-wide text-text-muted">
                {{ t('invite.shareVia') }}
              </p>
              <div class="grid grid-cols-4 gap-2">
                <a
                  v-for="s in shareLinks"
                  :key="s.key"
                  :href="s.href"
                  target="_blank"
                  rel="noopener noreferrer"
                  class="flex flex-col items-center gap-1.5 rounded-xl border border-border p-2.5 text-xs font-medium text-text transition hover:bg-surface-alt"
                >
                  <span
                    class="grid h-8 w-8 place-items-center rounded-full text-sm font-bold text-white"
                    :style="`background:${s.color}`"
                  >
                    {{ s.key.charAt(0) }}
                  </span>
                  {{ s.key }}
                </a>
              </div>

              <button
                type="button"
                class="mt-6 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover"
                @click="cancelInviteForm"
              >
                {{ t('invite.done') }}
              </button>
            </div>
          </template>
        </div>
      </div>
    </Teleport>
  </div>
</template>
