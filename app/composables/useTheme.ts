export const THEMES = [
  { id: 'corporate-blue', labelKey: 'theme.corporateBlue' },
  { id: 'emerald-green', labelKey: 'theme.emeraldGreen' },
  { id: 'sunset-orange', labelKey: 'theme.sunsetOrange' },
  { id: 'purple-neon', labelKey: 'theme.purpleNeon' },
  { id: 'dark-mode', labelKey: 'theme.darkMode' }
] as const

export type ThemeId = (typeof THEMES)[number]['id']

const STORAGE_KEY = 'tf_theme'
const DEFAULT_THEME: ThemeId = 'corporate-blue'
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
    const id = isThemeId(stored) ? stored : DEFAULT_THEME
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

  return { theme, THEMES, setTheme, applyTheme, initFromStorage }
}
