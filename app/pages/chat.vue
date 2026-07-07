<script setup lang="ts">
import { CHAT_COLORS } from '~/stores/chat'
import { resolveCapabilities } from '~/utils/permissions'

// Messenger-style team chat: teams on the left, the group conversation in the
// middle, team details (members + shared links) on the right. Live messages
// via Supabase realtime; per-team bubble color (managers set it).
const { t, locale } = useI18n()
const store = useWorkspacesStore()
const chat = useChatStore()
const supabase = useSupabaseClient()

// Remembers which conversation you had open, so leaving /chat and coming back
// (or reloading) drops you straight back into it instead of the team picker.
const LAST_TEAM_KEY = 'tf_chat_last_team'
const activeId = ref<string | null>(null)
const draft = ref('')
const myId = ref<string | null>(null)
const showColors = ref(false)
const search = ref('')
const scroller = ref<HTMLElement | null>(null)

const { pending } = await useAsyncData('chat-teams', async () => {
  if (!store.loaded) await store.fetchWorkspaces()
  return true
}, { lazy: true })

onMounted(async () => {
  const { data } = await supabase.auth.getUser()
  myId.value = data.user?.id ?? null
})

const filteredTeams = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return store.workspaces
  return store.workspaces.filter((w) => w.name.toLowerCase().includes(q))
})

const activeTeam = computed(() =>
  store.workspaces.find((w) => w.id === activeId.value) ?? null
)
const canSetColor = computed(
  () => !!activeTeam.value && resolveCapabilities(activeTeam.value.role).manageChat
)
const canSend = computed(
  () => !!activeTeam.value && !resolveCapabilities(activeTeam.value.role).viewOnly
)

// Shared-links panel: pull every URL people have posted in the conversation,
// newest first, de-duplicated — no extra table needed.
const URL_RE = /(https?:\/\/[^\s]+)/g
const sharedLinks = computed(() => {
  const seen = new Set<string>()
  const out: { url: string; label: string }[] = []
  for (let i = chat.messages.length - 1; i >= 0; i--) {
    const found = chat.messages[i].body.match(URL_RE)
    if (!found) continue
    for (const raw of found) {
      const url = raw.replace(/[.,)\]]+$/, '')
      if (seen.has(url)) continue
      seen.add(url)
      let label = url
      try {
        label = new URL(url).hostname.replace(/^www\./, '')
      } catch {
        // keep raw url as the label
      }
      out.push({ url, label })
    }
  }
  return out.slice(0, 10)
})

async function openTeam(id: string) {
  activeId.value = id
  if (import.meta.client) localStorage.setItem(LAST_TEAM_KEY, id)
  showColors.value = false
  chat.reset()
  await Promise.all([chat.fetchMessages(id), chat.fetchColor(id), chat.fetchMembers(id)])
  chat.subscribe(id)
  scrollToBottom()
}

function backToList() {
  activeId.value = null
  if (import.meta.client) localStorage.removeItem(LAST_TEAM_KEY)
  chat.unsubscribe()
}

// Reopen the last conversation once the team list is available (handles both a
// fresh load and returning to the page). Runs once; a valid stored id only.
const restored = ref(false)
watch(
  () => store.workspaces,
  (teams) => {
    if (restored.value || activeId.value || !teams.length || !import.meta.client) return
    const last = localStorage.getItem(LAST_TEAM_KEY)
    if (last && teams.some((w) => w.id === last)) {
      restored.value = true
      openTeam(last)
    }
  },
  { immediate: true }
)

async function send() {
  if (!draft.value.trim() || !activeId.value) return
  const body = draft.value
  draft.value = ''
  await chat.sendMessage(activeId.value, body)
  scrollToBottom()
}

async function pickColor(c: string) {
  if (!activeId.value) return
  await chat.setColor(activeId.value, c)
  showColors.value = false
}

function scrollToBottom() {
  nextTick(() => {
    if (scroller.value) scroller.value.scrollTop = scroller.value.scrollHeight
  })
}
watch(() => chat.messages.length, scrollToBottom)

onBeforeUnmount(() => chat.unsubscribe())

function initials(name: string) {
  return name.trim().slice(0, 2).toUpperCase() || '??'
}
function timeLabel(iso: string) {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
}
function dateLabel(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value)
}

const TINTS = [
  'bg-primary/10 text-primary',
  'bg-success/10 text-success',
  'bg-warning/10 text-warning',
  'bg-brand-accent/10 text-brand-accent',
  'bg-info/10 text-info'
]
function tint(id: string) {
  let h = 0
  for (const c of id) h = (h + c.charCodeAt(0)) % TINTS.length
  return TINTS[h]
}
</script>

<template>
  <div class="flex h-[calc(100vh-8.5rem)] min-h-[440px] gap-4">
    <!-- Team list -->
    <aside
      class="w-full flex-col rounded-2xl border border-border bg-surface shadow-card md:flex md:w-72 md:shrink-0"
      :class="activeId ? 'hidden' : 'flex'"
    >
      <div class="border-b border-border px-4 py-3">
        <h1 class="font-semibold text-text">{{ t('chat.title') }}</h1>
        <p class="text-xs text-text-muted">{{ t('chat.subtitle') }}</p>
      </div>
      <!-- Search -->
      <div class="px-3 pt-3">
        <div class="relative">
          <AppIcon name="search" class="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-text-muted" />
          <input
            v-model="search"
            type="text"
            :placeholder="t('chat.searchTeams')"
            class="w-full rounded-xl border border-border bg-surface-alt py-2 pl-9 pr-3 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </div>
      </div>
      <div class="flex-1 overflow-y-auto p-2">
        <p class="px-2 pb-1 pt-2 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {{ t('chat.yourTeams') }}
        </p>
        <p v-if="pending" class="p-4 text-sm text-text-muted">{{ t('common.loading') }}</p>
        <p v-else-if="store.workspaces.length === 0" class="p-4 text-sm text-text-muted">
          {{ t('chat.noTeams') }}
        </p>
        <button
          v-for="w in filteredTeams"
          :key="w.id"
          type="button"
          class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition"
          :class="activeId === w.id ? 'bg-primary/10' : 'hover:bg-surface-alt'"
          @click="openTeam(w.id)"
        >
          <span
            class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-sm font-bold"
            :class="tint(w.id)"
          >
            {{ initials(w.name) }}
          </span>
          <span class="min-w-0 flex-1">
            <span class="block truncate font-medium text-text">{{ w.name }}</span>
            <span class="block truncate text-xs text-text-muted">{{ t(`role.${w.role}`) }}</span>
          </span>
        </button>
      </div>
    </aside>

    <!-- Conversation -->
    <section
      class="min-w-0 flex-1 flex-col rounded-2xl border border-border bg-surface shadow-card md:flex"
      :class="activeId ? 'flex' : 'hidden md:flex'"
    >
      <!-- Empty (no team picked, desktop) -->
      <div
        v-if="!activeTeam"
        class="hidden flex-1 place-items-center text-text-muted md:grid"
      >
        <div class="text-center">
          <AppIcon name="chat" class="mx-auto h-10 w-10 opacity-40" />
          <p class="mt-2 text-sm">{{ t('chat.selectTeam') }}</p>
        </div>
      </div>

      <template v-else>
        <!-- Header -->
        <div class="flex items-center gap-3 border-b border-border px-4 py-3">
          <button
            type="button"
            class="text-text-muted hover:text-text md:hidden"
            @click="backToList"
          >
            <AppIcon name="chevron-down" class="h-5 w-5 rotate-90" />
          </button>
          <span
            class="grid h-9 w-9 shrink-0 place-items-center rounded-full text-xs font-bold"
            :class="tint(activeTeam.id)"
          >
            {{ initials(activeTeam.name) }}
          </span>
          <p class="min-w-0 flex-1 truncate font-semibold text-text">{{ activeTeam.name }}</p>

          <!-- Member count -->
          <span class="hidden items-center gap-1 text-sm text-text-muted sm:flex">
            <AppIcon name="members" class="h-4 w-4" />
            {{ chat.members.length }}
          </span>

          <!-- Color picker (managers only) -->
          <div v-if="canSetColor" class="relative">
            <button
              type="button"
              class="flex items-center gap-1.5 rounded-lg border border-border px-2.5 py-1.5 text-xs text-text-muted transition hover:text-text"
              @click="showColors = !showColors"
            >
              <span class="h-4 w-4 rounded-full" :style="{ backgroundColor: chat.color }" />
              {{ t('chat.color') }}
            </button>
            <div
              v-if="showColors"
              class="absolute right-0 top-full z-20 mt-2 w-64 rounded-2xl border border-border bg-surface p-4 shadow-card"
            >
              <p class="mb-3 text-xs font-semibold text-text-muted">{{ t('chat.color') }}</p>
              <div class="grid grid-cols-5 gap-3">
                <button
                  v-for="c in CHAT_COLORS"
                  :key="c"
                  type="button"
                  class="grid aspect-square w-full place-items-center rounded-full transition hover:opacity-80"
                  :style="{ backgroundColor: c }"
                  @click="pickColor(c)"
                >
                  <AppIcon v-if="chat.color === c" name="check" class="h-4 w-4 text-white" />
                </button>
              </div>
            </div>
          </div>
        </div>

        <!-- Messages -->
        <div ref="scroller" class="flex-1 space-y-3 overflow-y-auto px-4 py-4">
          <p v-if="chat.loading && chat.messages.length === 0" class="text-center text-sm text-text-muted">
            {{ t('common.loading') }}
          </p>
          <p
            v-else-if="chat.messages.length === 0"
            class="py-10 text-center text-sm text-text-muted"
          >
            {{ t('chat.empty') }}
          </p>

          <div
            v-for="m in chat.messages"
            :key="m.id"
            class="flex items-end gap-2"
            :class="m.userId === myId ? 'flex-row-reverse' : ''"
          >
            <img
              v-if="m.authorAvatar"
              :src="m.authorAvatar"
              :alt="m.authorName"
              class="h-7 w-7 shrink-0 rounded-full object-cover"
            />
            <span
              v-else
              class="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary/15 text-[10px] font-bold text-primary"
            >
              {{ initials(m.authorName) }}
            </span>
            <div class="max-w-[75%]">
              <p
                v-if="m.userId !== myId"
                class="mb-0.5 ml-1 text-xs text-text-muted"
              >
                {{ m.authorName }}
              </p>
              <div
                class="whitespace-pre-wrap break-words rounded-2xl px-3 py-2 text-sm"
                :class="m.userId === myId ? 'text-white' : 'bg-surface-alt text-text'"
                :style="m.userId === myId ? { backgroundColor: chat.color } : {}"
              >
                {{ m.body }}
              </div>
              <p
                class="mt-0.5 text-[10px] text-text-muted"
                :class="m.userId === myId ? 'text-right mr-1' : 'ml-1'"
              >
                {{ timeLabel(m.createdAt) }}
              </p>
            </div>
          </div>
        </div>

        <!-- Composer -->
        <form
          v-if="canSend"
          class="flex items-center gap-2 border-t border-border px-3 py-3"
          @submit.prevent="send"
        >
          <input
            v-model="draft"
            type="text"
            maxlength="2000"
            :placeholder="t('chat.placeholder')"
            class="flex-1 rounded-full border border-border bg-surface-alt px-4 py-2.5 text-sm text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
          <button
            type="submit"
            :disabled="!draft.trim()"
            class="grid h-10 w-10 shrink-0 place-items-center rounded-full text-white transition disabled:opacity-50"
            :style="{ backgroundColor: chat.color }"
          >
            <AppIcon name="send" class="h-5 w-5" />
          </button>
        </form>
        <p v-else class="border-t border-border px-4 py-3 text-center text-xs text-text-muted">
          {{ t('chat.viewerOnly') }}
        </p>
      </template>
    </section>

    <!-- Team details -->
    <aside
      v-if="activeTeam"
      class="hidden w-72 shrink-0 flex-col gap-4 overflow-y-auto xl:flex"
    >
      <!-- Team card -->
      <div class="rounded-2xl border border-border bg-surface p-4 shadow-card">
        <div class="flex items-center gap-3">
          <span
            class="grid h-11 w-11 shrink-0 place-items-center rounded-full text-sm font-bold"
            :class="tint(activeTeam.id)"
          >
            {{ initials(activeTeam.name) }}
          </span>
          <div class="min-w-0">
            <p class="truncate font-semibold text-text">{{ activeTeam.name }}</p>
            <p class="text-xs text-text-muted">{{ t(`role.${activeTeam.role}`) }}</p>
          </div>
        </div>
        <p class="mt-3 text-xs text-text-muted">
          {{ t('chat.createdOn', { date: dateLabel(activeTeam.createdAt) }) }}
        </p>
      </div>

      <!-- Members -->
      <div class="rounded-2xl border border-border bg-surface p-4 shadow-card">
        <p class="mb-3 text-sm font-semibold text-text">
          {{ t('chat.members') }} ({{ chat.members.length }})
        </p>
        <ul class="space-y-2.5">
          <li v-for="m in chat.members" :key="m.id" class="flex items-center gap-2.5">
            <img
              v-if="m.avatar"
              :src="m.avatar"
              :alt="m.name"
              class="h-8 w-8 shrink-0 rounded-full object-cover"
            />
            <span
              v-else
              class="grid h-8 w-8 shrink-0 place-items-center rounded-full bg-primary/15 text-xs font-bold text-primary"
            >
              {{ initials(m.name) }}
            </span>
            <div class="min-w-0 flex-1">
              <p class="truncate text-sm font-medium text-text">{{ m.name }}</p>
              <p class="truncate text-xs text-text-muted">{{ t(`role.${m.role}`) }}</p>
            </div>
          </li>
        </ul>
      </div>

      <!-- Shared links -->
      <div class="rounded-2xl border border-border bg-surface p-4 shadow-card">
        <p class="mb-3 text-sm font-semibold text-text">{{ t('chat.sharedLinks') }}</p>
        <p v-if="sharedLinks.length === 0" class="text-xs text-text-muted">
          {{ t('chat.noLinks') }}
        </p>
        <ul v-else class="space-y-2">
          <li v-for="link in sharedLinks" :key="link.url" class="flex items-center gap-2.5">
            <span class="grid h-8 w-8 shrink-0 place-items-center rounded-lg bg-info/10 text-info">
              <AppIcon name="workspace" class="h-4 w-4" />
            </span>
            <a
              :href="link.url"
              target="_blank"
              rel="noopener noreferrer"
              class="min-w-0 flex-1 truncate text-sm text-primary hover:underline"
              :title="link.url"
            >
              {{ link.label }}
            </a>
          </li>
        </ul>
      </div>
    </aside>
  </div>
</template>
