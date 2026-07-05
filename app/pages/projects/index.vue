<script setup lang="ts">
const { t, locale } = useI18n()
const supabase = useSupabaseClient()

const { data, pending } = await useAsyncData(
  'all-projects',
  async () => {
    const [projectsRes, tasksRes] = await Promise.all([
      supabase
        .from('projects')
        .select('id, name, description, created_at, workspace:workspaces (id, name)')
        .order('created_at', { ascending: false }),
      supabase.from('tasks').select('project_id, status')
    ])

    const counts = new Map<string, { total: number; done: number }>()
    for (const tk of tasksRes.data ?? []) {
      const c = counts.get(tk.project_id) ?? { total: 0, done: 0 }
      c.total++
      if (tk.status === 'done') c.done++
      counts.set(tk.project_id, c)
    }

    return {
      projects: (projectsRes.data ?? []).map((p) => {
        const c = counts.get(p.id) ?? { total: 0, done: 0 }
        return {
          ...p,
          total: c.total,
          done: c.done,
          pct: c.total ? Math.round((c.done / c.total) * 100) : 0
        }
      })
    }
  },
  { lazy: true }
)

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString(locale.value, {
    day: 'numeric',
    month: 'short',
    year: 'numeric'
  })
}
</script>

<template>
  <div class="mx-auto max-w-6xl">
    <h1 class="text-2xl font-bold text-text">{{ t('nav.projects') }}</h1>

    <p v-if="pending" class="mt-6 text-text-muted">{{ t('common.loading') }}</p>
    <p
      v-else-if="!data || data.projects.length === 0"
      class="mt-6 rounded-2xl border border-dashed border-border p-10 text-center text-text-muted"
    >
      {{ t('project.empty') }}
    </p>

    <div v-else class="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
      <NuxtLink
        v-for="project in data.projects"
        :key="project.id"
        :to="`/projects/${project.id}`"
        class="flex flex-col rounded-2xl border border-border bg-surface p-5 shadow-card transition hover:border-primary hover:shadow-md"
      >
        <div class="flex items-center gap-3">
          <span class="grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
            <AppIcon name="projects" class="h-5 w-5" />
          </span>
          <div class="min-w-0">
            <p class="truncate font-semibold text-text">{{ project.name }}</p>
            <p class="truncate text-xs text-text-muted">{{ project.workspace?.name }}</p>
          </div>
        </div>

        <p v-if="project.description" class="mt-3 line-clamp-2 text-sm text-text-muted">
          {{ project.description }}
        </p>

        <div class="mt-auto pt-4">
          <div class="flex items-center justify-between text-xs text-text-muted">
            <span>{{ project.done }}/{{ project.total }} {{ t('dashboard.stats.tasks') }}</span>
            <span>{{ project.pct }}%</span>
          </div>
          <div class="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-alt">
            <div class="h-full rounded-full bg-primary" :style="`width:${project.pct}%`" />
          </div>
          <p class="mt-3 text-xs text-text-muted">
            {{ t('workspace.createdAt') }} {{ formatDate(project.created_at) }}
          </p>
        </div>
      </NuxtLink>
    </div>
  </div>
</template>
