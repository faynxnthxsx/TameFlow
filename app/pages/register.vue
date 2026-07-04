<script setup lang="ts">
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const supabase = useSupabaseClient()

const PASSWORD_MIN = 8

const name = ref('')
const email = ref('')
const password = ref('')
const confirmPassword = ref('')
const loading = ref(false)
const errorMsg = ref('')
const awaitingVerification = ref(false)

function validate(): string {
  if (!name.value || !email.value || !password.value || !confirmPassword.value) {
    return t('validation.required')
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.value)) {
    return t('validation.email')
  }
  if (password.value.length < PASSWORD_MIN) {
    return t('validation.minLength', { min: PASSWORD_MIN })
  }
  if (password.value !== confirmPassword.value) {
    return t('validation.passwordMismatch')
  }
  return ''
}

async function submit() {
  errorMsg.value = validate()
  if (errorMsg.value) return

  loading.value = true
  const { data, error } = await supabase.auth.signUp({
    email: email.value,
    password: password.value,
    options: {
      data: { full_name: name.value },
      emailRedirectTo: `${window.location.origin}/confirm`
    }
  })
  loading.value = false

  if (error) {
    errorMsg.value = error.message.includes('already registered')
      ? t('auth.register.emailTaken')
      : t('error.generic')
    return
  }

  // Session is returned immediately when email confirmation is disabled;
  // otherwise the user must click the link we just emailed them.
  if (data.session) {
    await navigateTo('/')
  } else {
    awaitingVerification.value = true
  }
}
</script>

<template>
  <div class="w-full max-w-md rounded-lg border border-border bg-surface p-8 shadow-card">
    <template v-if="awaitingVerification">
      <h1 class="text-2xl font-semibold text-text">{{ t('auth.verifyEmail.title') }}</h1>
      <p class="mt-4 text-text-muted">{{ t('auth.verifyEmail.message') }}</p>
      <NuxtLink to="/login" class="mt-6 block text-center text-sm font-medium text-primary hover:underline">
        {{ t('auth.register.login') }}
      </NuxtLink>
    </template>

    <template v-else>
      <h1 class="text-2xl font-semibold text-text">{{ t('auth.register.title') }}</h1>

      <form class="mt-6 flex flex-col gap-4" novalidate @submit.prevent="submit">
        <div>
          <label for="name" class="mb-1 block text-sm font-medium text-text">{{ t('auth.register.name') }}</label>
          <input
            id="name"
            v-model="name"
            type="text"
            autocomplete="name"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label for="email" class="mb-1 block text-sm font-medium text-text">{{ t('auth.register.email') }}</label>
          <input
            id="email"
            v-model="email"
            type="email"
            autocomplete="email"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label for="password" class="mb-1 block text-sm font-medium text-text">{{ t('auth.register.password') }}</label>
          <input
            id="password"
            v-model="password"
            type="password"
            autocomplete="new-password"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none"
          />
        </div>
        <div>
          <label for="confirm-password" class="mb-1 block text-sm font-medium text-text">{{ t('auth.register.confirmPassword') }}</label>
          <input
            id="confirm-password"
            v-model="confirmPassword"
            type="password"
            autocomplete="new-password"
            class="w-full rounded-md border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none"
          />
        </div>

        <p v-if="errorMsg" class="text-sm text-danger">{{ errorMsg }}</p>

        <button
          type="submit"
          :disabled="loading"
          class="rounded-md bg-primary px-4 py-2.5 text-sm font-medium text-primary-fg hover:bg-primary-hover disabled:opacity-60"
        >
          {{ loading ? t('common.loading') : t('auth.register.submit') }}
        </button>
      </form>

      <p class="mt-6 text-center text-sm text-text-muted">
        {{ t('auth.register.haveAccount') }}
        <NuxtLink to="/login" class="font-medium text-primary hover:underline">{{ t('auth.register.login') }}</NuxtLink>
      </p>
    </template>
  </div>
</template>
