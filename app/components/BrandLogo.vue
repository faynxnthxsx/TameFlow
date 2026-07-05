<script setup lang="ts">
withDefaults(
  defineProps<{
    // Show the "TeamFlow" wordmark next to the mark.
    withText?: boolean
    // Show the tagline under the wordmark (implies withText).
    withTagline?: boolean
    size?: 'sm' | 'md' | 'lg'
  }>(),
  { withText: true, withTagline: false, size: 'md' }
)

const MARK_SIZE = { sm: 'h-8 w-8 text-sm', md: 'h-9 w-9 text-base', lg: 'h-11 w-11 text-lg' }
const TEXT_SIZE = { sm: 'text-base', md: 'text-lg', lg: 'text-2xl' }
</script>

<template>
  <div class="flex items-center gap-2.5">
    <span
      :class="MARK_SIZE[size]"
      class="grid shrink-0 place-items-center rounded-xl bg-gradient-to-br from-primary to-brand-accent font-bold text-white shadow-sm"
    >
      TF
    </span>
    <span v-if="withText || withTagline" class="flex flex-col leading-tight">
      <span :class="TEXT_SIZE[size]" class="font-bold tracking-tight text-text">TeamFlow</span>
      <span v-if="withTagline" class="text-xs text-text-muted">
        Smart Team Collaboration Platform
      </span>
    </span>
  </div>
</template>
