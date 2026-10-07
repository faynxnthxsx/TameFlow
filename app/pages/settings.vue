<script setup lang="ts">
import { SUPPORTED_LOCALES } from '~/composables/useLocalePreference'


const { t, locale } = useI18n()
const { theme, THEMES, setTheme } = useTheme()
const { locale: appLocale, setPreferredLocale } = useLocalePreference()
const { profile, loadProfile } = useProfileState()
const supabase = useSupabaseClient()
const wsStore = useWorkspacesStore()

onMounted(() => {
  if (!profile.value.email) loadProfile()
})

const { data, pending, refresh } = await useAsyncData('settings-data', async () => {
  const { data: auth } = await supabase.auth.getUser()
  const uid = auth.user?.id ?? null
  const email = auth.user?.email ?? null
  let joined = auth.user?.created_at ?? null

  if (!wsStore.loaded) await wsStore.fetchWorkspaces()

  // Unique people across all my teams
  const wsIds = wsStore.workspaces.map((w) => w.id)
  let uniqueMembers = 0
  if (wsIds.length) {
    const { data: mrows } = await supabase
      .from('workspace_members')
      .select('user_id')
      .in('workspace_id', wsIds)
    uniqueMembers = new Set((mrows ?? []).map((r) => r.user_id)).size
  }

  let lineUserId = null

  if (uid) {
    // Get earliest membership date as "joined"
    const { data: mems } = await supabase
      .from('workspace_members')
      .select('created_at')
      .eq('user_id', uid)
      .order('created_at', { ascending: true })
      .limit(1)
    if (mems?.[0]) joined = mems[0].created_at

    // Fetch LINE user ID
    const { data: prof } = await supabase
      .from('user_profiles')
      .select('line_user_id')
      .eq('id', uid)
      .single()
    if (prof) lineUserId = prof.line_user_id
  }

  return { email, joined, uniqueMembers, lineUserId }
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

async function disconnectLine() {
  const { data: auth } = await supabase.auth.getUser()
  if (!auth.user) return
  await supabase.from('user_profiles').update({ line_user_id: null }).eq('id', auth.user.id)
  if (data.value) data.value.lineUserId = null
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

        <!-- Integrations (LINE) -->
        <section class="rounded-2xl border border-border bg-surface p-6 shadow-card">
          <h2 class="text-lg font-semibold text-text">การแจ้งเตือน LINE</h2>
          <p class="mt-1 text-sm text-text-muted">รับการแจ้งเตือนงานใหม่ๆ และสรุปงานผ่านแชท LINE</p>
          
          <div v-if="pending" class="mt-4 flex h-20 items-center justify-center rounded-xl border border-border bg-surface-alt">
             <span class="text-sm text-text-muted">กำลังตรวจสอบสถานะ...</span>
          </div>
          <div v-else-if="data?.lineUserId" class="mt-4 flex items-center justify-between rounded-xl border border-[#00B900]/20 bg-[#00B900]/5 px-4 py-4">
            <div class="flex items-center gap-3">
              <div class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-[#00B900] text-white">
                <svg xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg>
              </div>
              <div class="min-w-0">
                <p class="truncate text-sm font-semibold text-[#00B900]">เชื่อมต่อบัญชี LINE เรียบร้อยแล้ว</p>
                <p class="truncate text-xs text-text-muted">คุณจะได้รับการแจ้งเตือนอัตโนมัติเมื่อมีคนมอบหมายงาน</p>
              </div>
            </div>
            <button type="button" @click="disconnectLine" class="shrink-0 rounded-xl px-3 py-2 text-sm font-medium text-text-muted hover:bg-danger/10 hover:text-danger transition">ยกเลิกเชื่อมต่อ</button>
          </div>
          <div v-else class="mt-4 flex flex-col items-start sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border bg-surface-alt p-4">
            <div>
              <p class="text-sm font-medium text-text">ยังไม่ได้เชื่อมต่อบัญชี LINE</p>
              <p class="mt-1 text-xs text-text-muted">ผูกบัญชีเพื่อรับการแจ้งเตือนงานและเช็คงานค้างได้ผ่านแชท</p>
            </div>
            <a href="/api/line/login" class="mt-3 sm:mt-0 inline-flex shrink-0 items-center gap-2 rounded-xl bg-[#00B900] px-5 py-2.5 text-sm font-medium text-white shadow-sm transition hover:bg-[#009900]">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path></svg>
              เชื่อมต่อบัญชี LINE
            </a>
          </div>
        </section>

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
