// The app ships a single blue brand theme in two modes: a light appearance
// ('corporate-blue') and a dark one ('dark-mode'). The id stays the persisted
// value (localStorage + user_profiles.preferred_theme) so nothing downstream
// needed to change when we collapsed the old multi-theme picker into a toggle.
export const THEMES = [
  { id: 'corporate-blue', labelKey: 'theme.light' },
  { id: 'dark-mode', labelKey: 'theme.dark' }
] as const

export type ThemeId = (typeof THEMES)[number]['id']

const LIGHT_THEME: ThemeId = 'corporate-blue'
const DARK_THEME: ThemeId = 'dark-mode'

const STORAGE_KEY = 'tf_theme'
const DEFAULT_THEME: ThemeId = LIGHT_THEME
const THEME_IDS = THEMES.map((t) => t.id)

export function isThemeId(value: string | null): value is ThemeId {
  return !!value && THEME_IDS.includes(value as ThemeId)
}

function applyThemeToDocument(id: ThemeId) {
  if (import.meta.client) {
    document.documentElement.dataset.theme = id
  }
}

/**
 * Reactive current theme, shared across the app via useState.
 * Persistence priority (mirrors i18n): DB preference (applied on login by
 * app/plugins/profile-prefs.client.ts) > localStorage > default.
 */
export function useTheme() {
  const theme = useState<ThemeId>('tf-theme', () => DEFAULT_THEME)
  const user = useSupabaseUser()
  const supabase = useSupabaseClient()

  function initFromStorage() {
    if (!import.meta.client) return
    const stored = localStorage.getItem(STORAGE_KEY)
    // No stored choice yet → follow the OS light/dark preference.
    const prefersDark = window.matchMedia?.('(prefers-color-scheme: dark)').matches
    const id = isThemeId(stored) ? stored : prefersDark ? DARK_THEME : DEFAULT_THEME
    theme.value = id
    applyThemeToDocument(id)
  }

  /** Applies the theme locally (state, DOM, localStorage) without touching the DB. */
  function applyTheme(id: ThemeId) {
    theme.value = id
    applyThemeToDocument(id)
    if (import.meta.client) {
      localStorage.setItem(STORAGE_KEY, id)
    }
  }

  function setTheme(id: ThemeId) {
    applyTheme(id)
    if (user.value) {
      void supabase
        .from('user_profiles')
        .update({ preferred_theme: id })
        .eq('id', user.value.id)
        .then(({ error }) => {
          if (error) console.warn('Failed to sync preferred_theme:', error.message)
        })
    }
  }

  const isDark = computed(() => theme.value === DARK_THEME)

  /** Flip between light and dark, persisting like setTheme. */
  function toggleTheme() {
    setTheme(isDark.value ? LIGHT_THEME : DARK_THEME)
  }

  return { theme, THEMES, isDark, setTheme, applyTheme, toggleTheme, initFromStorage }
}
