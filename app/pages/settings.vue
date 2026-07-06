<script setup lang="ts">
import { SUPPORTED_LOCALES } from '~/composables/useLocalePreference'

const { t } = useI18n()
const { theme, THEMES, setTheme } = useTheme()
const { locale, setPreferredLocale } = useLocalePreference()
const { profile, loadProfile } = useProfileState()
const supabase = useSupabaseClient()

onMounted(() => {
  if (!profile.value.email) loadProfile()
})

function initials(name: string) {
  const parts = name.trim().split(/\s+/)
  return ((parts[0]?.[0] ?? '') + (parts[1]?.[0] ?? '')).toUpperCase() || 'U'
}

const signingOut = ref(false)
async function signOut() {
  signingOut.value = true
  await supabase.auth.signOut()
  await navigateTo('/login')
}
</script>

<template>
  <div class="mx-auto max-w-3xl">
    <h1 class="text-2xl font-bold text-text">{{ t('nav.settings') }}</h1>
    <p class="mt-1 text-sm text-text-muted">{{ t('settings.subtitle') }}</p>

    <div class="mt-6 space-y-4">
      <!-- Profile summary -->
      <section class="overflow-hidden rounded-2xl border border-border bg-surface shadow-card">
        <div class="h-16 bg-gradient-to-br from-primary to-brand-accent" />
        <div class="flex flex-wrap items-center gap-4 px-6 pb-5">
          <img
            v-if="profile.avatar"
            :src="profile.avatar"
            alt=""
            class="-mt-8 h-16 w-16 rounded-2xl object-cover ring-4 ring-surface"
          />
          <span
            v-else
            class="-mt-8 grid h-16 w-16 place-items-center rounded-2xl bg-gradient-to-br from-primary to-brand-accent text-xl font-bold text-primary-fg ring-4 ring-surface"
          >
            {{ initials(profile.name) }}
          </span>
          <div class="min-w-0 flex-1">
            <p class="truncate text-lg font-bold text-text">{{ profile.name || '—' }}</p>
            <p class="truncate text-sm text-text-muted">{{ profile.email }}</p>
          </div>
          <NuxtLink
            to="/profile"
            class="inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted transition hover:text-text"
          >
            <AppIcon name="user" class="h-4 w-4" />
            {{ t('settings.editProfile') }}
          </NuxtLink>
        </div>
      </section>

      <!-- Appearance -->
      <section class="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <h2 class="text-lg font-semibold text-text">{{ t('theme.label') }}</h2>
        <p class="mt-1 text-sm text-text-muted">{{ t('settings.appearanceDesc') }}</p>
        <div class="mt-4 grid grid-cols-2 gap-3">
          <button
            v-for="opt in THEMES"
            :key="opt.id"
            type="button"
            class="flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition"
            :class="
              theme === opt.id
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text-muted hover:text-text'
            "
            @click="setTheme(opt.id)"
          >
            {{ t(opt.labelKey) }}
            <AppIcon v-if="theme === opt.id" name="check" class="h-4 w-4" />
          </button>
        </div>
      </section>

      <!-- Language -->
      <section class="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <h2 class="text-lg font-semibold text-text">{{ t('language.label') }}</h2>
        <p class="mt-1 text-sm text-text-muted">{{ t('settings.languageDesc') }}</p>
        <div class="mt-4 grid gap-3 sm:grid-cols-3">
          <button
            v-for="lc in SUPPORTED_LOCALES"
            :key="lc"
            type="button"
            class="flex items-center justify-between rounded-xl border px-4 py-3 text-sm font-medium transition"
            :class="
              locale === lc
                ? 'border-primary bg-primary/10 text-primary'
                : 'border-border text-text-muted hover:text-text'
            "
            @click="setPreferredLocale(lc)"
          >
            <span class="flex items-center gap-2">
              <AppFlag :code="lc" class="h-4 w-6" />
              {{ t(`language.${lc}`) }}
            </span>
            <AppIcon v-if="locale === lc" name="check" class="h-4 w-4" />
          </button>
        </div>
      </section>

      <!-- Account -->
      <section class="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <h2 class="text-lg font-semibold text-text">{{ t('settings.account') }}</h2>
        <p class="mt-1 text-sm text-text-muted">{{ t('settings.signOutDesc') }}</p>
        <button
          type="button"
          :disabled="signingOut"
          class="mt-4 inline-flex items-center gap-2 rounded-xl border border-danger/30 px-4 py-2.5 text-sm font-medium text-danger transition hover:bg-danger/10 disabled:opacity-60"
          @click="signOut"
        >
          <AppIcon name="logout" class="h-4 w-4" />
          {{ t('settings.signOut') }}
        </button>
      </section>

      <!-- About -->
      <section class="flex items-center gap-4 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <span class="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
          <AppIcon name="building" class="h-5 w-5" />
        </span>
        <div class="min-w-0 flex-1">
          <p class="font-semibold text-text">{{ t('settings.about') }}</p>
          <p class="text-sm text-text-muted">{{ t('settings.aboutDesc') }}</p>
        </div>
        <span class="shrink-0 rounded-full bg-surface-alt px-2.5 py-1 text-xs font-medium text-text-muted">
          {{ t('settings.version') }} 1.0
        </span>
      </section>
    </div>
  </div>
</template>
