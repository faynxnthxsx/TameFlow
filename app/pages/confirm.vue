<script setup lang="ts">
// OAuth + email-confirmation landing page. The @nuxtjs/supabase module
// exchanges the auth code from the URL automatically; we just wait for the
// session to appear and then move on.
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const user = useSupabaseUser()
const route = useRoute()

const failed = ref(!!route.query.error)

// Honor a page stashed by an invite link (/join/<token>) so OAuth sign-in
// returns there; otherwise land on the dashboard.
function postLoginTarget() {
  if (typeof window === 'undefined') return '/'
  const dest = localStorage.getItem('tf_post_login')
  localStorage.removeItem('tf_post_login')
  return dest || '/'
}

watch(
  user,
  (u) => {
    if (u) navigateTo(postLoginTarget(), { replace: true })
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
