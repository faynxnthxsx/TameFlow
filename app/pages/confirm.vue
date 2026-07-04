<script setup lang="ts">
// OAuth + email-confirmation landing page. The @nuxtjs/supabase module
// exchanges the auth code from the URL automatically; we just wait for the
// session to appear and then move on.
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const user = useSupabaseUser()
const route = useRoute()

const failed = ref(!!route.query.error)

watch(
  user,
  (u) => {
    if (u) navigateTo('/', { replace: true })
  },
  { immediate: true }
)

onMounted(() => {
  setTimeout(() => {
    if (!user.value) failed.value = true
  }, 8000)
})
</script>

<template>
  <div class="w-full max-w-md rounded-lg border border-border bg-surface p-8 text-center shadow-card">
    <template v-if="failed">
      <p class="text-danger">{{ t('error.generic') }}</p>
      <NuxtLink to="/login" class="mt-4 block text-sm font-medium text-primary hover:underline">
        {{ t('auth.login.title') }}
      </NuxtLink>
    </template>
    <p v-else class="text-text-muted">{{ t('common.loading') }}</p>
  </div>
</template>
