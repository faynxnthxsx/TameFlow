<script setup lang="ts">
import { SUPPORTED_LOCALES, type LocaleId } from '~/composables/useLocalePreference'

const { locale, setPreferredLocale } = useLocalePreference()
const { t } = useI18n()

const open = ref(false)
const root = ref<HTMLElement | null>(null)
onClickOutside(root, () => (open.value = false))

function choose(code: LocaleId) {
  setPreferredLocale(code)
  open.value = false
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 py-1.5 text-sm font-medium text-text transition hover:bg-surface-alt"
      :aria-label="t('language.label')"
      @click="open = !open"
    >
      <AppFlag :code="locale" class="h-3.5 w-5" />
      <span class="uppercase">{{ locale }}</span>
      <AppIcon name="chevron-down" class="h-3.5 w-3.5 text-text-muted" />
    </button>

    <Transition
      enter-active-class="transition duration-150 ease-out"
      enter-from-class="opacity-0 -translate-y-1"
      leave-active-class="transition duration-100 ease-in"
      leave-to-class="opacity-0 -translate-y-1"
    >
      <ul
        v-if="open"
        class="absolute right-0 z-20 mt-2 w-44 overflow-hidden rounded-xl border border-border bg-surface py-1 shadow-modal"
      >
        <li v-for="code in SUPPORTED_LOCALES" :key="code">
          <button
            type="button"
            class="flex w-full items-center gap-3 px-3 py-2 text-sm transition"
            :class="
              locale === code
                ? 'bg-primary/10 font-medium text-primary'
                : 'text-text hover:bg-surface-alt'
            "
            @click="choose(code)"
          >
            <AppFlag :code="code" class="h-4 w-6" />
            <span class="flex-1 text-left">{{ t(`language.${code}`) }}</span>
            <AppIcon v-if="locale === code" name="check" class="h-4 w-4" />
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>
