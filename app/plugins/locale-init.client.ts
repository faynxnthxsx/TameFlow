export default defineNuxtPlugin((nuxtApp) => {
  // useI18n() requires a Vue component setup context, which a plugin is not,
  // so we drive the global i18n instance (nuxtApp.$i18n) directly here.
  const i18n = nuxtApp.$i18n as { setLocale: (locale: string) => unknown }
  i18n.setLocale(resolveStoredLocale())
})
