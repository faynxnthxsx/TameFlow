// Applies DB-stored preferences (user_profiles.preferred_theme/_language)
// whenever a user session appears — on login and on page load while logged
// in. DB wins over localStorage; the fetch resolves after the *-init
// plugins have applied the localStorage values, so this overwrite is the
// "DB > localStorage" priority in practice.
export default defineNuxtPlugin((nuxtApp) => {
  const user = useSupabaseUser()
  const supabase = useSupabaseClient()
  const { applyTheme } = useTheme()
  const i18n = nuxtApp.$i18n as { setLocale: (locale: string) => unknown }

  watch(
    user,
    async (u) => {
      if (!u?.id) return
      const { data, error } = await supabase
        .from('user_profiles')
        .select('preferred_theme, preferred_language')
        .eq('id', u.id)
        .single()
      if (error || !data) return

      if (isThemeId(data.preferred_theme)) {
        applyTheme(data.preferred_theme)
      }
      if (isLocaleId(data.preferred_language)) {
        i18n.setLocale(data.preferred_language)
        storeLocalePreference(data.preferred_language)
      }
    },
    { immediate: true }
  )
})
