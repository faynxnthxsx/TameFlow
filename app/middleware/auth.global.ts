// Route protection (replaces the @nuxtjs/supabase built-in redirect, which
// is disabled via redirectOptions.exclude in nuxt.config.ts).
const PUBLIC_PATHS = ['/login', '/register', '/confirm', '/reset-password']

// Invite-link landing pages (/join/<token>) are viewable signed-out so the
// visitor can see which workspace invited them before logging in.
function isPublic(path: string) {
  return PUBLIC_PATHS.includes(path) || path.startsWith('/join/')
}

export default defineNuxtRouteMiddleware((to) => {
  const user = useSupabaseUser()

  if (!user.value && !isPublic(to.path)) {
    return navigateTo('/login')
  }

  if (user.value && (to.path === '/login' || to.path === '/register')) {
    return navigateTo('/')
  }
})
