<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const supabase = useSupabaseClient()

const email = ref('')
const password = ref('')
const loading = ref(false)
const errorMsg = ref('')

async function submit() {
  errorMsg.value = ''
  if (!email.value || !password.value) {
    errorMsg.value = t('validation.required')
    return
  }
  loading.value = true
  const { error } = await supabase.auth.signInWithPassword({
    email: email.value,
    password: password.value
  })
  loading.value = false
  if (error) {
    errorMsg.value = error.message === 'Invalid login credentials'
      ? t('auth.login.invalidCredentials')
      : t('error.generic')
    return
  }
  await navigateTo('/')
}

async function signInWithProvider(provider: 'google' | 'github') {
  errorMsg.value = ''
  const { error } = await supabase.auth.signInWithOAuth({
    provider,
    options: { redirectTo: `${window.location.origin}/confirm` }
  })
  if (error) errorMsg.value = t('error.generic')
}
</script>

<template>
  <div class="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-modal">
    <div class="flex flex-col items-center text-center">
      <BrandLogo :with-text="false" size="lg" />
      <h1 class="mt-4 text-2xl font-bold text-text">{{ t('auth.login.welcome') }}</h1>
      <p class="mt-1 text-sm text-text-muted">{{ t('auth.login.subtitle') }}</p>
    </div>

    <div class="mt-7 flex flex-col gap-3">
      <button
        type="button"
        class="flex items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface-alt"
        @click="signInWithProvider('google')"
      >
        <svg class="h-5 w-5" viewBox="0 0 24 24" aria-hidden="true">
          <path fill="#4285F4" d="M23.5 12.27c0-.85-.08-1.66-.22-2.45H12v4.64h6.45a5.52 5.52 0 0 1-2.39 3.62v3h3.87c2.26-2.09 3.57-5.16 3.57-8.81Z" />
          <path fill="#34A853" d="M12 24c3.24 0 5.96-1.07 7.93-2.91l-3.87-3a7.25 7.25 0 0 1-10.8-3.8H1.27v3.1A12 12 0 0 0 12 24Z" />
          <path fill="#FBBC05" d="M5.26 14.28a7.19 7.19 0 0 1 0-4.56v-3.1H1.27a12 12 0 0 0 0 10.76l3.99-3.1Z" />
          <path fill="#EA4335" d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.43-3.43A11.98 11.98 0 0 0 1.27 6.62l3.99 3.1A7.18 7.18 0 0 1 12 4.75Z" />
        </svg>
        {{ t('auth.oauth.google') }}
      </button>
      <button
        type="button"
        class="flex items-center justify-center gap-3 rounded-lg border border-border bg-surface px-4 py-2.5 text-sm font-medium text-text transition-colors hover:bg-surface-alt"
        @click="signInWithProvider('github')"
      >
        <svg class="h-5 w-5 fill-current" viewBox="0 0 16 16" aria-hidden="true">
          <path d="M8 0C3.58 0 0 3.58 0 8c0 3.54 2.29 6.53 5.47 7.59.4.07.55-.17.55-.38 0-.19-.01-.82-.01-1.49-2.01.37-2.53-.49-2.69-.94-.09-.23-.48-.94-.82-1.13-.28-.15-.68-.52-.01-.53.63-.01 1.08.58 1.23.82.72 1.21 1.87.87 2.33.66.07-.52.28-.87.51-1.07-1.78-.2-3.64-.89-3.64-3.95 0-.87.31-1.59.82-2.15-.08-.2-.36-1.02.08-2.12 0 0 .67-.21 2.2.82a7.42 7.42 0 0 1 4 0c1.53-1.04 2.2-.82 2.2-.82.44 1.1.16 1.92.08 2.12.51.56.82 1.27.82 2.15 0 3.07-1.87 3.75-3.65 3.95.29.25.54.73.54 1.48 0 1.07-.01 1.93-.01 2.2 0 .21.15.46.55.38A8.01 8.01 0 0 0 16 8c0-4.42-3.58-8-8-8Z" />
        </svg>
        {{ t('auth.oauth.github') }}
      </button>
    </div>

    <div class="mt-6 flex items-center gap-3">
      <div class="h-px flex-1 bg-border" />
      <span class="text-xs uppercase text-text-muted">{{ t('common.or') }}</span>
      <div class="h-px flex-1 bg-border" />
    </div>

    <form class="mt-6 flex flex-col gap-4" novalidate @submit.prevent="submit">
      <div>
        <label for="email" class="mb-1 block text-sm font-medium text-text">{{ t('auth.login.email') }}</label>
        <input
          id="email"
          v-model="email"
          type="email"
          autocomplete="email"
          placeholder="you@example.com"
          class="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>
      <div>
        <label for="password" class="mb-1 block text-sm font-medium text-text">{{ t('auth.login.password') }}</label>
        <input
          id="password"
          v-model="password"
          type="password"
          autocomplete="current-password"
          placeholder="••••••••"
          class="w-full rounded-lg border border-border bg-surface px-3 py-2.5 text-text placeholder:text-text-muted focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
        />
      </div>

      <p v-if="errorMsg" class="text-sm text-danger">{{ errorMsg }}</p>

      <button
        type="submit"
        :disabled="loading"
        class="mt-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg shadow-sm transition-colors hover:bg-primary-hover disabled:opacity-60"
      >
        {{ loading ? t('common.loading') : t('auth.login.submit') }}
      </button>
    </form>

    <p class="mt-6 text-center text-sm text-text-muted">
      {{ t('auth.login.noAccount') }}
      <NuxtLink to="/register" class="font-medium text-primary hover:underline">{{ t('auth.login.register') }}</NuxtLink>
    </p>
  </div>
</template>
