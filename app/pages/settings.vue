<script setup lang="ts">
import { SUPPORTED_LOCALES, type LocaleId } from '~/composables/useLocalePreference'

const { t } = useI18n()
const { theme, THEMES, setTheme } = useTheme()
const { locale, setPreferredLocale } = useLocalePreference()

const FLAGS: Record<LocaleId, string> = { en: '🇬🇧', th: '🇹🇭', ja: '🇯🇵' }
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <h1 class="text-2xl font-bold text-text">{{ t('nav.settings') }}</h1>

    <div class="mt-6 space-y-4">
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
              <span class="text-base leading-none">{{ FLAGS[lc] }}</span>
              {{ t(`language.${lc}`) }}
            </span>
            <AppIcon v-if="locale === lc" name="check" class="h-4 w-4" />
          </button>
        </div>
      </section>

      <!-- Account -->
      <section class="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <h2 class="text-lg font-semibold text-text">{{ t('settings.account') }}</h2>
        <p class="mt-1 text-sm text-text-muted">{{ t('settings.accountDesc') }}</p>
        <NuxtLink
          to="/profile"
          class="mt-4 inline-flex items-center gap-2 rounded-xl border border-border px-4 py-2 text-sm font-medium text-text-muted transition hover:text-text"
        >
          <AppIcon name="user" class="h-4 w-4" />
          {{ t('settings.editProfile') }}
        </NuxtLink>
      </section>
    </div>
  </div>
</template>
