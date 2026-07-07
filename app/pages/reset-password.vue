<script setup lang="ts">
// Landing for the password-reset email link. Supabase (@nuxtjs/supabase)
// exchanges the recovery code in the URL automatically, giving us a temporary
// session; the user then picks a new password here.
definePageMeta({ layout: 'auth' })

const { t } = useI18n()
const supabase = useSupabaseClient()
const user = useSupabaseUser()

const pw = ref('')
const pw2 = ref('')
const errorMsg = ref('')
const saving = ref(false)
const done = ref(false)
// No recovery session showed up in time → the link is stale/invalid.
const expired = ref(false)

// Live validation, same rules as the change-password modal in settings.
const pwShort = computed(() => pw.value.length > 0 && pw.value.length < 8)
const pwMismatch = computed(() => pw2.value.length > 0 && pw.value !== pw2.value)
const pwValid = computed(() => pw.value.length >= 8 && pw.value === pw2.value)

onMounted(() => {
  setTimeout(() => {
    if (!user.value) expired.value = true
  }, 8000)
})

async function submit() {
  errorMsg.value = ''
  if (!pwValid.value) return
  saving.value = true
  const { error } = await supabase.auth.updateUser({ password: pw.value })
  saving.value = false
  if (error) {
    errorMsg.value = t('error.generic')
    return
  }
  done.value = true
}
</script>

<template>
  <div class="w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-modal">
    <div class="flex flex-col items-center text-center">
      <BrandLogo :with-text="false" size="lg" />
      <h1 class="mt-4 text-2xl font-bold text-text">{{ t('auth.reset.title') }}</h1>
      <p class="mt-1 text-sm text-text-muted">{{ t('auth.reset.subtitle') }}</p>
    </div>

    <!-- Success -->
    <template v-if="done">
      <p class="mt-7 flex items-start gap-2 rounded-xl bg-success/10 p-3 text-sm text-success">
        <AppIcon name="check" class="mt-0.5 h-4 w-4 shrink-0" />{{ t('auth.reset.success') }}
      </p>
      <NuxtLink
        to="/login"
        class="mt-4 block rounded-lg bg-primary px-4 py-2.5 text-center text-sm font-semibold text-primary-fg shadow-sm transition hover:bg-primary-hover"
      >
        {{ t('auth.login.submit') }}
      </NuxtLink>
    </template>

    <!-- Expired / invalid link -->
    <template v-else-if="expired">
      <p class="mt-7 text-sm text-danger">{{ t('auth.reset.expired') }}</p>
      <NuxtLink to="/login" class="mt-4 block text-center text-sm font-medium text-primary hover:underline">
        {{ t('auth.reset.toLogin') }}
      </NuxtLink>
    </template>

    <!-- Waiting for the recovery session -->
    <p v-else-if="!user" class="mt-7 text-center text-sm text-text-muted">{{ t('common.loading') }}</p>

    <!-- New-password form -->
    <form v-else class="mt-7 flex flex-col gap-4" novalidate @submit.prevent="submit">
      <div>
        <label for="new-pw" class="mb-1 block text-sm font-medium text-text">{{ t('settings.newPassword') }}</label>
        <input
          id="new-pw"
          v-model="pw"
          type="password"
          autocomplete="new-password"
          placeholder="••••••••"
          class="w-full rounded-lg border bg-surface px-3 py-2.5 text-text placeholder:text-text-muted focus:outline-none focus:ring-2"
          :class="pwShort ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border focus:border-primary focus:ring-primary/20'"
        />
        <p v-if="pwShort" class="mt-1 text-xs text-danger">{{ t('settings.pwTooShort') }}</p>
      </div>
      <div>
        <label for="new-pw2" class="mb-1 block text-sm font-medium text-text">{{ t('settings.confirmNewPassword') }}</label>
        <input
          id="new-pw2"
          v-model="pw2"
          type="password"
          autocomplete="new-password"
          placeholder="••••••••"
          class="w-full rounded-lg border bg-surface px-3 py-2.5 text-text placeholder:text-text-muted focus:outline-none focus:ring-2"
          :class="pwMismatch ? 'border-danger focus:border-danger focus:ring-danger/20' : 'border-border focus:border-primary focus:ring-primary/20'"
        />
        <p v-if="pwMismatch" class="mt-1 text-xs text-danger">{{ t('validation.passwordMismatch') }}</p>
      </div>

      <p v-if="errorMsg" class="text-sm text-danger">{{ errorMsg }}</p>

      <button
        type="submit"
        :disabled="saving || !pwValid"
        class="mt-1 rounded-lg bg-primary px-4 py-2.5 text-sm font-semibold text-primary-fg shadow-sm transition hover:bg-primary-hover disabled:opacity-60"
      >
        {{ saving ? t('common.loading') : t('auth.reset.submit') }}
      </button>
    </form>
  </div>
</template>
