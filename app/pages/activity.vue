<script setup lang="ts">
const { t, locale } = useI18n()
const supabase = useSupabaseClient()

interface FeedItem {
  kind: 'task' | 'project'
  id: string
  at: string
  actor: string | null
  title: string
  context: string | null
  link: string
}

const { data, pending } = await useAsyncData(
  'activity-feed',
  async () => {
    const [tasksRes, projectsRes] = await Promise.all([
      supabase
        .from('tasks')
        .select(
          'id, title, created_at, project:projects (name), creator:user_profiles!tasks_created_by_fkey (display_name)'
        )
        .order('created_at', { ascending: false })
        .limit(20),
      supabase
        .from('projects')
        .select(
          'id, name, created_at, workspace:workspaces (name), creator:user_profiles!projects_created_by_fkey (display_name)'
        )
        .order('created_at', { ascending: false })
        .limit(20)
    ])

    const items: FeedItem[] = [
      ...(tasksRes.data ?? []).map((tk) => ({
        kind: 'task' as const,
        id: `t-${tk.id}`,
        at: tk.created_at,
        actor: tk.creator?.display_name ?? null,
        title: tk.title,
        context: tk.project?.name ?? null,
        link: `/tasks/${tk.id}`
      })),
      ...(projectsRes.data ?? []).map((p) => ({
        kind: 'project' as const,
        id: `p-${p.id}`,
        at: p.created_at,
        actor: p.creator?.display_name ?? null,
        title: p.name,
        context: p.workspace?.name ?? null,
        link: `/projects/${p.id}`
      }))
    ]
      .sort((a, b) => b.at.localeCompare(a.at))
      .slice(0, 25)

    return { items }
  },
  { lazy: true }
)

const UNITS: [Intl.RelativeTimeFormatUnit, number][] = [
  ['year', 31536000],
  ['month', 2592000],
  ['week', 604800],
  ['day', 86400],
  ['hour', 3600],
  ['minute', 60]
]

function timeAgo(iso: string) {
  const diff = (Date.now() - new Date(iso).getTime()) / 1000
  const rtf = new Intl.RelativeTimeFormat(locale.value, { numeric: 'auto' })
  for (const [unit, secs] of UNITS) {
    if (diff >= secs) return rtf.format(-Math.floor(diff / secs), unit)
  }
  return rtf.format(0, 'second')
}

// Bucket the feed into Today / Yesterday / dated sections for a timeline look.
function dayStart(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime()
}
function bucketLabel(iso: string) {
  const today = dayStart(new Date())
  const day = dayStart(new Date(iso))
  const diffDays = Math.round((today - day) / 86_400_000)
  if (diffDays <= 0) return t('activity.today')
  if (diffDays === 1) return t('activity.yesterday')
  return new Date(iso).toLocaleDateString(locale.value, { day: 'numeric', month: 'long', year: 'numeric' })
}

const groups = computed(() => {
  const out: { label: string; items: FeedItem[] }[] = []
  for (const item of data.value?.items ?? []) {
    const label = bucketLabel(item.at)
    const last = out[out.length - 1]
    if (last && last.label === label) last.items.push(item)
    else out.push({ label, items: [item] })
  }
  return out
})
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <h1 class="text-2xl font-bold text-text">{{ t('nav.activity') }}</h1>
    <p class="mt-1 text-sm text-text-muted">{{ t('activity.subtitle') }}</p>

    <p v-if="pending" class="mt-6 text-text-muted">{{ t('common.loading') }}</p>
    <p
      v-else-if="!data || data.items.length === 0"
      class="mt-6 flex flex-col items-center gap-3 rounded-2xl border border-dashed border-border p-12 text-center text-text-muted"
    >
      <AppIcon name="activity" class="h-8 w-8 text-text-muted/50" />
      {{ t('activity.empty') }}
    </p>

    <div v-else class="mt-6 space-y-6">
      <section v-for="group in groups" :key="group.label">
        <h2 class="mb-2 px-1 text-xs font-semibold uppercase tracking-wide text-text-muted">
          {{ group.label }}
        </h2>
        <ul class="relative ml-4 space-y-1 border-l border-border pl-6">
          <li v-for="item in group.items" :key="item.id" class="relative">
            <!-- Timeline node -->
            <span
              class="absolute -left-[31px] top-3 grid h-8 w-8 place-items-center rounded-full ring-4 ring-bg"
              :class="item.kind === 'task' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
            >
              <AppIcon :name="item.kind === 'task' ? 'tasks' : 'projects'" class="h-4 w-4" />
            </span>
            <NuxtLink
              :to="item.link"
              class="flex items-start gap-3 rounded-xl border border-transparent p-3 transition hover:border-border hover:bg-surface"
            >
              <div class="min-w-0 flex-1">
                <p class="text-sm text-text">
                  <span class="font-medium">{{ item.actor ?? '—' }}</span>
                  {{ t(item.kind === 'task' ? 'activity.createdTask' : 'activity.createdProject') }}
                  <span class="font-medium">{{ item.title }}</span>
                </p>
                <p v-if="item.context" class="truncate text-xs text-text-muted">{{ item.context }}</p>
              </div>
              <span class="shrink-0 text-xs text-text-muted">{{ timeAgo(item.at) }}</span>
            </NuxtLink>
          </li>
        </ul>
      </section>
    </div>
  </div>
</template>
