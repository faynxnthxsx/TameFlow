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
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="text-2xl font-bold text-text">{{ t('nav.activity') }}</h1>

    <p v-if="pending" class="mt-6 text-text-muted">{{ t('common.loading') }}</p>
    <p
      v-else-if="!data || data.items.length === 0"
      class="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-text-muted"
    >
      {{ t('activity.empty') }}
    </p>

    <ul v-else class="mt-6 space-y-1">
      <li v-for="item in data.items" :key="item.id">
        <NuxtLink
          :to="item.link"
          class="flex items-start gap-3 rounded-xl p-3 transition hover:bg-surface"
        >
          <span
            class="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-full"
            :class="item.kind === 'task' ? 'bg-warning/10 text-warning' : 'bg-success/10 text-success'"
          >
            <AppIcon :name="item.kind === 'task' ? 'tasks' : 'projects'" class="h-5 w-5" />
          </span>
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
  </div>
</template>
