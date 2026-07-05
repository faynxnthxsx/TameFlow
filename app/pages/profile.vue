<script setup lang="ts">
const { t, locale } = useI18n()
const supabase = useSupabaseClient()
const { setProfile } = useProfileState()

const { data, pending } = await useAsyncData(
  'my-profile',
  async () => {
    const { data: auth } = await supabase.auth.getUser()
    const uid = auth.user?.id ?? ''
    const email = auth.user?.email ?? ''
    if (!uid) return { uid: '', email, display_name: '', avatar_url: '', created_at: '' }
    const { data: row } = await supabase
      .from('user_profiles')
      .select('display_name, avatar_url, created_at')
      .eq('id', uid)
      .single()
    return {
      uid,
      email,
      display_name: row?.display_name ?? '',
      avatar_url: row?.avatar_url ?? '',
      created_at: row?.created_at ?? ''
    }
  },
  { lazy: true }
)

const displayName = ref('')
const avatarUrl = ref('')
const saving = ref(false)
const errorMsg = ref('')
const savedMsg = ref('')

// --- avatar upload ---
const MAX_AVATAR_BYTES = 2 * 1024 * 1024 // 2 MB
const uploading = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)

function pickFile() {
  fileInput.value?.click()
}

async function onFileChange(e: Event) {
  const input = e.target as HTMLInputElement
  const file = input.files?.[0]
  input.value = '' // allow re-picking the same file later
  if (!file || !data.value?.uid) return

  errorMsg.value = ''
  savedMsg.value = ''
  if (!file.type.startsWith('image/')) {
    errorMsg.value = t('profile.photoInvalid')
    return
  }
  if (file.size > MAX_AVATAR_BYTES) {
    errorMsg.value = t('profile.photoTooLarge')
    return
  }

  uploading.value = true
  const ext = (file.name.split('.').pop() || 'png').toLowerCase()
  const path = `${data.value.uid}/${crypto.randomUUID()}.${ext}`
  const { error: upErr } = await supabase.storage
    .from('avatars')
    .upload(path, file, { cacheControl: '3600', upsert: true })
  uploading.value = false
  if (upErr) {
    errorMsg.value = t('error.generic')
    return
  }
  avatarUrl.value = supabase.storage.from('avatars').getPublicUrl(path).data.publicUrl
}

function removePhoto() {
  avatarUrl.value = ''
  errorMsg.value = ''
  savedMsg.value = ''
}

// Seed the editable fields once the profile loads.
watch(
  data,
  (d) => {
    if (!d) return
    displayName.value = d.display_name
    avatarUrl.value = d.avatar_url
  },
  { immediate: true }
)

const initial = computed(() => (displayName.value || data.value?.email || '?').charAt(0).toUpperCase())

async function save() {
  if (!data.value?.uid) return
  saving.value = true
  errorMsg.value = ''
  savedMsg.value = ''
  const { error } = await supabase
    .from('user_profiles')
    .update({
      display_name: displayName.value.trim() || null,
      avatar_url: avatarUrl.value.trim() || null
    })
    .eq('id', data.value.uid)
  saving.value = false
  if (error) {
    errorMsg.value = t('error.generic')
    return
  }
  savedMsg.value = t('profile.saved')
  data.value.display_name = displayName.value.trim()
  data.value.avatar_url = avatarUrl.value.trim()
  // Reflect the change everywhere (sidebar footer, etc.) immediately.
  setProfile({
    name: displayName.value.trim() || data.value.email.split('@')[0] || 'User',
    avatar: avatarUrl.value.trim() || null
  })
}

function formatDate(iso: string) {
  return iso ? new Date(iso).toLocaleDateString(locale.value, { year: 'numeric', month: 'long', day: 'numeric' }) : ''
}
</script>

<template>
  <div class="mx-auto max-w-2xl">
    <div>
      <h1 class="text-2xl font-bold text-text">{{ t('profile.title') }}</h1>
      <p class="mt-1 text-sm text-text-muted">{{ t('profile.subtitle') }}</p>
    </div>

    <p v-if="pending" class="mt-8 text-text-muted">{{ t('common.loading') }}</p>

    <form v-else class="mt-6 space-y-6" @submit.prevent="save">
      <!-- Identity card -->
      <section class="rounded-2xl border border-border bg-surface p-6 shadow-card">
        <div class="flex items-center gap-4">
          <img
            v-if="avatarUrl"
            :src="avatarUrl"
            alt=""
            class="h-16 w-16 rounded-2xl object-cover"
          />
          <div
            v-else
            class="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-primary to-brand-accent text-2xl font-bold text-white"
          >
            {{ initial }}
          </div>
          <div class="min-w-0">
            <p class="truncate text-lg font-semibold text-text">{{ displayName || t('profile.displayNamePlaceholder') }}</p>
            <p class="truncate text-sm text-text-muted">{{ data?.email }}</p>
            <p v-if="data?.created_at" class="mt-1 text-xs text-text-muted">
              {{ t('profile.memberSince') }} {{ formatDate(data.created_at) }}
            </p>
          </div>
        </div>
      </section>

      <!-- Editable fields -->
      <section class="space-y-5 rounded-2xl border border-border bg-surface p-6 shadow-card">
        <label class="block">
          <span class="text-sm font-medium text-text">{{ t('profile.displayName') }}</span>
          <input
            v-model="displayName"
            type="text"
            maxlength="80"
            :placeholder="t('profile.displayNamePlaceholder')"
            class="mt-1.5 w-full rounded-xl border border-border bg-surface px-3 py-2 text-text focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
          />
        </label>

        <label class="block">
          <span class="text-sm font-medium text-text">{{ t('profile.email') }}</span>
          <input
            :value="data?.email"
            type="email"
            disabled
            class="mt-1.5 w-full cursor-not-allowed rounded-xl border border-border bg-surface-alt px-3 py-2 text-text-muted"
          />
          <span class="mt-1 block text-xs text-text-muted">{{ t('profile.emailReadonly') }}</span>
        </label>

        <div class="block">
          <span class="text-sm font-medium text-text">{{ t('profile.photo') }}</span>
          <div class="mt-1.5 flex items-center gap-4">
            <img
              v-if="avatarUrl"
              :src="avatarUrl"
              alt=""
              class="h-16 w-16 shrink-0 rounded-2xl object-cover"
            />
            <div
              v-else
              class="grid h-16 w-16 shrink-0 place-items-center rounded-2xl bg-surface-alt text-text-muted"
            >
              <AppIcon name="user" class="h-7 w-7" />
            </div>
            <div class="flex flex-col gap-2">
              <div class="flex flex-wrap gap-2">
                <button
                  type="button"
                  :disabled="uploading"
                  class="inline-flex items-center gap-2 rounded-xl border border-border px-3 py-2 text-sm font-medium text-text transition hover:bg-surface-alt disabled:opacity-60"
                  @click="pickFile"
                >
                  <AppIcon name="camera" class="h-4 w-4" />
                  {{ uploading ? t('profile.uploading') : t('profile.uploadPhoto') }}
                </button>
                <button
                  v-if="avatarUrl"
                  type="button"
                  class="rounded-xl border border-border px-3 py-2 text-sm font-medium text-text-muted transition hover:border-danger hover:text-danger"
                  @click="removePhoto"
                >
                  {{ t('profile.removePhoto') }}
                </button>
              </div>
              <span class="text-xs text-text-muted">{{ t('profile.photoHint') }}</span>
            </div>
          </div>
          <input
            ref="fileInput"
            type="file"
            accept="image/*"
            class="hidden"
            @change="onFileChange"
          />
        </div>
      </section>

      <div class="flex items-center gap-4">
        <button
          type="submit"
          :disabled="saving"
          class="rounded-xl bg-primary px-5 py-2.5 text-sm font-medium text-primary-fg shadow-sm transition hover:bg-primary-hover disabled:opacity-60"
        >
          {{ saving ? t('common.loading') : t('profile.save') }}
        </button>
        <p v-if="savedMsg" class="text-sm font-medium text-success">{{ savedMsg }}</p>
        <p v-if="errorMsg" class="text-sm text-danger">{{ errorMsg }}</p>
      </div>
    </form>
  </div>
</template>
