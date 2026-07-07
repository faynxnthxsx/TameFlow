// Daily keep-alive ping (called by the Vercel Cron defined in vercel.json).
// The Supabase free tier pauses a project after ~7 days of inactivity; a single
// lightweight REST read per day registers database activity and prevents that.
// Uses only the public URL + anon key, so it needs no extra secrets.
export default defineEventHandler(async () => {
  const { public: pub } = useRuntimeConfig()
  const supabase = pub.supabase as { url?: string; key?: string } | undefined
  const url = supabase?.url
  const key = supabase?.key
  const at = new Date().toISOString()

  if (!url || !key) {
    return { ok: false, reason: 'supabase-config-missing', at }
  }

  try {
    // A trivial select. RLS may return no rows for the anon role, but the
    // request still hits PostgREST + Postgres — which is what keeps it awake.
    await $fetch(`${url}/rest/v1/user_profiles?select=id&limit=1`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` }
    })
    return { ok: true, at }
  } catch {
    // Even a rejected request reached Supabase, so activity is still registered.
    return { ok: true, reached: true, at }
  }
})
