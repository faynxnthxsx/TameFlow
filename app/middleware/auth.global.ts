// Route protection (replaces the @nuxtjs/supabase built-in redirect, which
// is disabled via redirectOptions.exclude in nuxt.config.ts).
const PUBLIC_PATHS = ['/login', '/register', '/confirm']

export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()

  if (!user.value && !PUBLIC_PATHS.includes(to.path)) {
    return navigateTo('/login')
  }

  if (user.value && (to.path === '/login' || to.path === '/register')) {
    return navigateTo('/')
  }
})
