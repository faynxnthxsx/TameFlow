export const SUPPORTED_LOCALES = ['en', 'th', 'ja'] as const
export type LocaleId = (typeof SUPPORTED_LOCALES)[number]

const STORAGE_KEY = 'tf_locale'
const DEFAULT_LOCALE: LocaleId = 'en'

export function isLocaleId(value: string | null | undefined): value is LocaleId {
  return !!value && (SUPPORTED_LOCALES as readonly string[]).includes(value)
}

function detectBrowserLocale(): LocaleId {
  if (!import.meta.client) return DEFAULT_LOCALE
  const nav = navigator.language?.slice(0, 2)
  return isLocaleId(nav) ? nav : DEFAULT_LOCALE
}

/** Resolves the locale to apply on boot: localStorage > browser language > default. */
export function resolveStoredLocale(): LocaleId {
  if (!import.meta.client) return DEFAULT_LOCALE
  const stored = localStorage.getItem(STORAGE_KEY)
  return isLocaleId(stored) ? stored : detectBrowserLocale()
}

/** Persists the locale choice to localStorage (no DB write). */
export function storeLocalePreference(id: LocaleId) {
  if (import.meta.client) {
    localStorage.setItem(STORAGE_KEY, id)
  }
}

/**
 * Wraps @nuxtjs/i18n's setLocale with localStorage persistence.
 * Must be called from within a component's setup() — useI18n() relies on
 * Vue's component instance context. For plugin-time initialization (before
 * any component exists), use `resolveStoredLocale()` with `nuxtApp.$i18n`
 * directly instead (see app/plugins/locale-init.client.ts).
 * Persistence priority: DB preference (applied on login by
 * app/plugins/profile-prefs.client.ts) > localStorage > browser language > default.
 */
export function useLocalePreference() {
  const { locale, setLocale } = useI18n()
  const user = useSupabaseUser()
  const supabase = useSupabaseClient()

  function setPreferredLocale(id: LocaleId) {
    setLocale(id)
    storeLocalePreference(id)
    if (user.value) {
      void supabase
        .from('user_profiles')
        .update({ preferred_language: id })
        .eq('id', user.value.id)
        .then(({ error }) => {
          if (error) console.warn('Failed to sync preferred_language:', error.message)
        })
    }
  }

  return { locale, setPreferredLocale }
}
