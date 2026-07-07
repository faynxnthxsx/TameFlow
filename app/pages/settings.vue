<script setup lang="ts">
import { SUPPORTED_LOCALES } from '~/composables/useLocalePreference'
import type { WorkspaceRole } from '~/utils/permissions'

const { t, locale } = useI18n()
const { theme, THEMES, setTheme } = useTheme()
const { locale: appLocale, setPreferredLocale } = useLocalePreference()
const { profile, loadProfile } = useProfileState()
const supabase = useSupabaseClient()
const wsStore = useWorkspacesStore()

onMounted(() => {
  if (!profile.value.email) loadProfile()
})

const { data } = await useAsyncData('settings-data', async () => {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id ?? null
  const email = auth.user?.email ?? null
  let joined = auth.user?.created_at ?? null
  let role: WorkspaceRole | null = null

  if (!wsStore.loaded) await wsStore.fetchWorkspaces()

  // Unique people across all my teams (a person in N teams must count once —
  // summing each team's memberCount would double-count me, see /overview).
  const wsIds = wsStore.workspaces.map((w) => w.id)
  let uniqueMembers = 0
  if (wsIds.length) {
    const { data: mrows } = await supabase
      .from('workspace_members')
      .select('user_id')
      .in('workspace_id', wsIds)
    uniqueMembers = new Set((mrows ?? []).map((r) => r.user_id)).size
  }

  if (uid) {
    const { data: mems } = await supabase
      .from('workspace_members')
      .select('role, created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: true })
    if (mems && mems.length) {
      joined = mems[0].created_at
      const rank: Record<string, number> = { owner: 3, admin: 2, member: 1, viewer: 0 }
      role = mems.reduce<WorkspaceRole | null>(
        (best, m) => (rank[m.role] > (best ? rank[best] : -1) ? (m.role as WorkspaceRole) : best),
        null
      )
    }
  }

  const [tasksRes, projectsRes] = await Promise.all([
    supabase.from('tasks').select('id, title, created_at').order('created_at', { ascending: false }).limit(6),
    supabase.from('projects').select('id, name, created_at').order('created_at', { ascending: false }).limit(6)
  ])
  const activity = [
    ...(tasksRes.data ?? []).map((x) => ({ id: `t-${x.id}`, kind: 'task' as const, title: x.title, at: x.created_at, link: `/tasks/${x.id}` })),
    ...(projectsRes.data ?? []).map((x) => ({ id: `p-${x.id}`, kind: 'project' as const, title: x.name, at: x.created_at, link: `/projects/${x.id}` }))
  ]
    .sort((a, b) => b.at.localeCompare(a.at))
    .slice(0, 4)

  return { email, role, joined, activity, uniqueMembers }
}, { lazy: true })

const teamTotals = computed(() => ({
  teams: wsStore.workspaces.length,
  members: data.value?.uniqueMembers ?? 0,
  projects: wsStore.workspaces.reduce((n, w) => n + w.projectCount, 0)
}))

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U'
}
function formatDate(iso: string | null) {
  return iso ? new Date(iso).toLocaleDateString(locale.value, { day: 'numeric', month: 'short', year: 'numeric' }) : '—'
}
const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]
]
function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  for (const [unit, secs] of UNITS) if (diff >= secs) return rtf.format(-Math.floor(diff / secs), unit)
  return rtf.format(0, 'second')
}

const SHORTCUTS = [
  { to: '/members', icon: 'members', key: 'scMembers' },
  { to: '/overview', icon: 'building', key: 'scOverview' },
  { to: '/reports', icon: 'reports', key: 'scReports' },
  { to: '/invitations', icon: 'mail', key: 'scInvitations' }
] as const

// --- change password ---
const showPw = ref(false)
const pw = ref('')
const pw2 = ref('')
const pwErr = ref('')
const pwOk = ref(false)
const savingPw = ref(false)
// Live validation so the user is told as they type, not only after submitting.
const pwShort = computed(() => pw.value.length > 0 && pw.value.length < 8)
const pwMismatch = computed(() => pw2.value.length > 0 && pw.value !== pw2.value)
const pwValid = computed(() => pw.value.length >= 8 && pw.value === pw2.value)

function openPw() {
  showPw.value = true
  pw.value = ''
  pw2.value = ''
  pwErr.value = ''
  pwOk.value = false
}
async function savePassword() {
  pwErr.value = ''
  if (pw.value.length < 8) { pwErr.value = t('settings.pwTooShort'); return }
  if (pw.value !== pw2.value) { pwErr.value = t('validation.passwordMismatch'); return }
  savingPw.value = true
  const { error } = await supabase.auth.updateUser({ password: pw.value })
  savingPw.value = false
  if (error) { pwErr.value = t('error.generic'); return }
  pwOk.value = true
  setTimeout(() => (showPw.value = false), 1200)
}

// --- change email ---
const showEmail = ref(false)
const newEmail = ref('')
const emailErr = ref('')
const emailOk = ref(false)
const savingEmail = ref(false)
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

function openEmail() {
  showEmail.value = true
  newEmail.value = ''
  emailErr.value = ''
  emailOk.value = false
}
async function saveEmail() {
  emailErr.value = ''
  const next = newEmail.value.trim()
  if (!EMAIL_RE.test(next)) { emailErr.value = t('settings.emailInvalid'); return }
  if (next.toLowerCase() === (data.value?.email ?? '').toLowerCase()) { emailErr.value = t('settings.emailSame'); return }
  savingEmail.value = true
  const { error } = await supabase.auth.updateUser({ email: next })
  savingEmail.value = false
  if (error) { emailErr.value = t('error.generic'); return }
  emailOk.value = true
}

const signingOut = ref(false)
async function signOut() {
  signingOut.value = true
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <h1 class="text-2xl font-bold text-text">{{ t('nav.settings') }}</h1>
    <p class="mt-1 text-sm text-text-muted">{{ t('settings.subtitle') }}</p>

    <div class="mt-6 flex flex-col gap-6 lg:flex-row">
      <!-- Main column -->
      <div class="min-w-0 flex-1 space-y-4">
        <!-- Profile card -->
        <section class="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
          <div class="h-16 bg-gradient-to-br from-primary to-primary-hover" />
          <div class="px-6 pb-5">
            <div class="flex flex-wrap items-center gap-4">
              <img
                v-if="profile.avatar"
                :src="profile.avatar"
                alt=""
                class="-mt-8 h-16 w-16 rounded-2xl object-cover ring-4 ring-surface"
              />
              <span
                v-else
                class="-mt-8 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-primary-hover text-xl font-bold text-primary-fg ring-4 ring-surface"
              >
                {{ initials(profile.name) }}
              </span>
              <div class="min-w-0 flex-1">
                <div class="flex flex-wrap items-center gap-2">
                  <p class="truncate text-lg font-bold text-text">{{ profile.name || '—' }}</p>
                  <span v-if="data?.role" class="rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                    {{ t(`role.${data.role}`) }}
                  </span>
                </div>
                <p class="truncate text-sm text-text-muted">{{ profile.email || data?.email }}</p>
              </div>
              <NuxtLink
                to="/profile"
                class="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted transition hover:text-text"
              >
                <AppIcon name="user" class="h-4 w-4" />
                {{ t('settings.editProfile') }}
              </NuxtLink>
            </div>

            <!-- stats strip -->
            <div class="mt-5 grid grid-cols-2 gap-4 border-t border-border pt-4">
              <div class="flex items-center gap-2">
                <AppIcon name="clock" class="h-4 w-4 text-text-muted" />
                <div>
                  <p class="text-xs text-text-muted">{{ t('settings.joinedOn') }}</p>
                  <p class="text-sm font-medium text-text">{{ formatDate(data?.joined ?? null) }}</p>
                </div>
              </div>
              <div class="flex items-center gap-2">
                <AppIcon name="building" class="h-4 w-4 text-text-muted" />
                <div>
                  <p class="text-xs text-text-muted">{{ t('settings.version') }}</p>
                  <p class="text-sm font-medium text-text">1.0</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <!-- Appearance + Language -->
        <div class="grid gap-4 sm:grid-cols-2">
          <section class="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <h2 class="text-lg font-semibold text-text">{{ t('theme.label') }}</h2>
            <p class="mt-1 text-sm text-text-muted">{{ t('settings.appearanceDesc') }}</p>
            <div class="mt-4 space-y-2">
              <button
                v-for="opt in THEMES"
                :key="opt.id"
                type="button"
                class="flex w-full items-center gap-2.5 rounded-xl border px-4 py-2.5 text-sm font-medium transition"
                :class="theme === opt.id ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted hover:text-text'"
                @click="setTheme(opt.id)"
              >
                <span
                  class="h-4 w-4 shrink-0 rounded-md ring-1 ring-border"
                  :class="opt.isDark ? 'bg-[#0f172a]' : 'bg-white'"
                />
                <span class="flex-1 text-left">{{ t(opt.labelKey) }}</span>
                <AppIcon v-if="theme === opt.id" name="check" class="h-4 w-4" />
              </button>
            </div>
          </section>

          <section class="rounded-2xl border border-border bg-surface p-6 shadow-card">
            <h2 class="text-lg font-semibold text-text">{{ t('language.label') }}</h2>
            <p class="mt-1 text-sm text-text-muted">{{ t('settings.languageDesc') }}</p>
            <div class="mt-4 space-y-2">
              <button
                v-for="lc in SUPPORTED_LOCALES"
                :key="lc"
                type="button"
                class="flex w-full items-center justify-between rounded-xl border px-4 py-2.5 text-sm font-medium transition"
                :class="appLocale === lc ? 'border-primary bg-primary/10 text-primary' : 'border-border text-text-muted hover:text-text'"
                @click="setPreferredLocale(lc)"
              >
                <span class="flex items-center gap-2">
                  <AppFlag :code="lc" class="h-4 w-6" />
                  {{ t(`language.${lc}`) }}
                </span>
                <AppIcon v-if="appLocale === lc" name="check" class="h-4 w-4" />
              </button>
            </div>
          </section>
        </div>

        <!-- Account -->
        <section class="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <h2 class="text-lg font-semibold text-text">{{ t('settings.account') }}</h2>
          <div class="mt-4 divide-y divide-border">
            <button
              type="button"
              class="flex w-full items-center gap-3 py-3 text-left transition hover:opacity-80"
              @click="openEmail"
            >
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-info/10 text-info">
                <AppIcon name="mail" class="h-4 w-4" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-text">{{ t('settings.changeEmail') }}</p>
                <p class="truncate text-xs text-text-muted">{{ data?.email || t('settings.changeEmailDesc') }}</p>
              </div>
              <AppIcon name="chevron-right" class="h-4 w-4 shrink-0 text-text-muted" />
            </button>
            <button
              type="button"
              class="flex w-full items-center gap-3 py-3 text-left transition hover:opacity-80"
              @click="openPw"
            >
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                <AppIcon name="link" class="h-4 w-4" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-text">{{ t('settings.changePassword') }}</p>
                <p class="text-xs text-text-muted">{{ t('settings.changePasswordDesc') }}</p>
              </div>
              <AppIcon name="chevron-right" class="h-4 w-4 shrink-0 text-text-muted" />
            </button>
            <button
              type="button"
              :disabled="signingOut"
              class="flex w-full items-center gap-3 py-3 text-left transition hover:opacity-80 disabled:opacity-60"
              @click="signOut"
            >
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-lg bg-danger/10 text-danger">
                <AppIcon name="logout" class="h-4 w-4" />
              </span>
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-danger">{{ t('settings.signOut') }}</p>
                <p class="text-xs text-text-muted">{{ t('settings.signOutDesc') }}</p>
              </div>
            </button>
          </div>
        </section>

        <!-- Team info -->
        <section class="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <h2 class="text-lg font-semibold text-text">{{ t('settings.teamInfo') }}</h2>
          <div class="mt-4 grid grid-cols-3 gap-4">
            <div>
              <p class="text-2xl font-bold text-text">{{ teamTotals.teams }}</p>
              <p class="text-xs text-text-muted">{{ t('settings.teamsTotal') }}</p>
            </div>
            <div>
              <p class="text-2xl font-bold text-text">{{ teamTotals.members }}</p>
              <p class="text-xs text-text-muted">{{ t('settings.membersTotal') }}</p>
            </div>
            <div>
              <p class="text-2xl font-bold text-text">{{ teamTotals.projects }}</p>
              <p class="text-xs text-text-muted">{{ t('settings.projectsTotal') }}</p>
            </div>
          </div>
        </section>
      </div>

      <!-- Right column -->
      <aside class="w-full shrink-0 space-y-4 lg:w-80">
        <!-- Recent activity -->
        <section class="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <div class="flex items-center justify-between">
            <h2 class="font-semibold text-text">{{ t('settings.recentActivity') }}</h2>
            <NuxtLink to="/activity" class="text-xs font-medium text-primary hover:underline">{{ t('settings.viewAll') }}</NuxtLink>
          </div>
          <ul v-if="data && data.activity.length" class="mt-3 space-y-3">
            <li v-for="a in data.activity" :key="a.id">
              <NuxtLink :to="a.link" class="flex items-start gap-2.5">
                <span
                  class="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-lg"
                  :class="a.kind === 'task' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
                >
                  <AppIcon :name="a.kind === 'task' ? 'tasks' : 'projects'" class="h-3.5 w-3.5" />
                </span>
                <div class="min-w-0 flex-1">
                  <p class="truncate text-sm text-text">
                    <span class="text-text-muted">{{ t(a.kind === 'task' ? 'activity.createdTask' : 'activity.createdProject') }}</span>
                    {{ a.title }}
                  </p>
                  <p class="text-xs text-text-muted">{{ timeAgo(a.at) }}</p>
                </div>
              </NuxtLink>
            </li>
          </ul>
          <p v-else class="mt-3 text-sm text-text-muted">{{ t('activity.empty') }}</p>
        </section>

        <!-- Shortcuts -->
        <section class="rounded-2xl border border-border bg-surface p-5 shadow-card">
          <h2 class="mb-3 font-semibold text-text">{{ t('settings.shortcuts') }}</h2>
          <div class="grid grid-cols-2 gap-2">
            <NuxtLink
              v-for="sc in SHORTCUTS"
              :key="sc.to"
              :to="sc.to"
              class="flex items-center gap-2 rounded-xl border border-border px-3 py-2.5 text-sm font-medium text-text transition hover:border-primary/50 hover:bg-surface-alt"
            >
              <AppIcon :name="sc.icon" class="h-4 w-4 shrink-0 text-text-muted" />
              <span class="truncate">{{ t(`settings.${sc.key}`) }}</span>
            </NuxtLink>
          </div>
        </section>
      </aside>
    </div>

    <!-- Change-email modal -->
    <Teleport to="body">
      <div v-if="showEmail" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-text/50 backdrop-blur-sm" @click="showEmail = false" />
        <div class="relative w-full max-w-sm rounded-2xl bg-surface p-6 shadow-modal">
          <div class="flex items-start justify-between gap-4">
            <h2 class="text-lg font-bold text-text">{{ t('settings.changeEmail') }}</h2>
            <button type="button" class="rounded-lg p-1 text-text-muted transition hover:bg-surface-alt hover:text-text" @click="showEmail = false">
              <AppIcon name="x" class="h-5 w-5" />
            </button>
          </div>

          <template v-if="emailOk">
            <p class="mt-5 flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm text-success">
              <AppIcon name="check" class="mt-0.5 h-4 w-4 shrink-0" />{{ t('settings.emailChangeSent') }}
            </p>
            <button
              type="button"
              class="mt-4 w-full rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover"
              @click="showEmail = false"
            >
              {{ t('common.close') }}
            </button>
          </template>
          <form v-else class="mt-5 flex flex-col gap-3" @submit.prevent="saveEmail">
            <p class="text-xs text-text-muted">{{ t('settings.currentEmail') }}: <span class="font-medium text-text">{{ data?.email || '—' }}</span></p>
            <input
              v-model="newEmail"
              type="email"
              autocomplete="email"
              :placeholder="t('settings.newEmail')"
              class="w-full rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
            />
            <p v-if="emailErr" class="text-sm text-danger">{{ emailErr }}</p>
            <button
              type="submit"
              :disabled="savingEmail"
              class="mt-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover disabled:opacity-60"
            >
              {{ savingEmail ? t('common.loading') : t('settings.updateEmail') }}
            </button>
          </form>
        </div>
      </div>
    </Teleport>

    <!-- Change-password modal -->
    <Teleport to="body">
      <div v-if="showPw" class="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div class="absolute inset-0 bg-text/50 backdrop-blur-sm" @click="showPw = false" />
        <div class="relative w-full max-w-sm rounded-2xl bg-surface p-6 shadow-modal">
          <div class="flex items-start justify-between gap-4">
            <h2 class="text-lg font-bold text-text">{{ t('settings.changePassword') }}</h2>
            <button type="button" class="rounded-lg p-1 text-text-muted transition hover:bg-surface-alt hover:text-text" @click="showPw = false">
              <AppIcon name="x" class="h-5 w-5" />
            </button>
          </div>

          <template v-if="pwOk">
            <p class="mt-5 flex items-center gap-2 rounded-xl bg-success/10 p-3 text-sm text-success">
              <AppIcon name="check" class="h-4 w-4" />{{ t('settings.passwordChanged') }}
            </p>
          </template>
          <form v-else class="mt-5 flex flex-col gap-3" @submit.prevent="savePassword">
            <div>
              <input
                v-model="pw"
                type="password"
                autocomplete="new-password"
                :placeholder="t('settings.newPassword')"
                class="w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2"
                :class="pwShort ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border focus:border-primary focus:ring-primary/20'"
              />
              <p v-if="pwShort" class="mt-1 text-xs text-danger">{{ t('settings.pwTooShort') }}</p>
            </div>
            <div>
              <input
                v-model="pw2"
                type="password"
                autocomplete="new-password"
                :placeholder="t('settings.confirmNewPassword')"
                class="w-full rounded-xl border bg-surface px-3.5 py-2.5 text-sm text-text focus:outline-none focus:ring-2"
                :class="pwMismatch ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border focus:border-primary focus:ring-primary/20'"
              />
              <p v-if="pwMismatch" class="mt-1 text-xs text-danger">{{ t('validation.passwordMismatch') }}</p>
            </div>
            <p v-if="pwErr" class="text-sm text-danger">{{ pwErr }}</p>
            <button
              type="submit"
              :disabled="savingPw || !pwValid"
              class="mt-1 rounded-xl bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover disabled:opacity-60"
            >
              {{ savingPw ? t('common.loading') : t('settings.updatePassword') }}
            </button>
          </form>
        </div>
      </div>
    </Teleport>
  </div>
</template>
