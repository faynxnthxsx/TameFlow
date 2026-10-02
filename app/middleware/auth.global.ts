// การป้องกันเส้นทาง (ใช้แทนระบบ redirect อัตโนมัติของ @nuxtjs/supabase
// ซึ่งถูกปิดการใช้งานเอาไว้ผ่าน redirectOptions.exclude ในไฟล์ nuxt.config.ts)
const PUBLIC_PATHS = ['/login', '/register', '/confirm', '/reset-password']

// หน้า Landing Page สำหรับลิงก์เชิญ (ที่ขึ้นต้นด้วย /join/<token>) สามารถเปิดดูได้แม้ยังไม่ได้ล็อกอิน
// เพื่อให้ผู้เข้ามาเยี่ยมชมสามารถเห็นได้ว่า "ทีม/workspace ไหน" เป็นคนเชิญมา ก่อนที่จะทำการล็อกอิน
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
