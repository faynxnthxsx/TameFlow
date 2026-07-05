// Shared reactive copy of the signed-in user's profile (name + avatar), so the
// sidebar footer, navbar, etc. all update the moment the profile page saves.
// Backed by useState so it's a single instance across every component.
export interface ProfileState {
  name: string
  email: string
  avatar: string | null
}

export function useProfileState() {
  const profile = useState<ProfileState>('tf-profile', () => ({
    name: '',
    email: '',
    avatar: null
  }))
  const supabase = useSupabaseClient()

  async function loadProfile() {
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id
    if (!uid) return
    const { data } = await supabase
      .from('user_profiles')
      .select('display_name, avatar_url')
      .eq('id', uid)
      .single()
    profile.value = {
      name: data?.display_name || auth.user?.email?.split('@')[0] || 'User',
      email: auth.user?.email ?? '',
      avatar: data?.avatar_url ?? null
    }
  }

  function setProfile(patch: Partial<ProfileState>) {
    profile.value = { ...profile.value, ...patch }
  }

  return { profile, loadProfile, setProfile }
}
