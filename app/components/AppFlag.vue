<script setup lang="ts">
// Inline SVG flags — flag emoji don't render on Windows/Chrome, so we draw them.
// `preserveAspectRatio="none"` lets each flag fill whatever box the class sets.
defineProps<{ code: string; class?: string }>()
</script>

<template>
  <span
    :class="[
      'inline-block shrink-0 overflow-hidden rounded-[3px] leading-none ring-1 ring-black/10',
      $props.class || 'h-3.5 w-5'
    ]"
  >
    <!-- Thailand -->
    <svg v-if="code === 'th'" viewBox="0 0 24 16" class="block h-full w-full" preserveAspectRatio="none">
      <rect width="24" height="16" fill="#fff" />
      <rect width="24" height="2.67" fill="#A51931" />
      <rect y="13.33" width="24" height="2.67" fill="#A51931" />
      <rect y="5.33" width="24" height="5.34" fill="#2D2A4A" />
    </svg>

    <!-- Japan -->
    <svg v-else-if="code === 'ja'" viewBox="0 0 24 16" class="block h-full w-full" preserveAspectRatio="none">
      <rect width="24" height="16" fill="#fff" />
      <circle cx="12" cy="8" r="4.2" fill="#BC002D" />
    </svg>

    <!-- United Kingdom (simplified Union Jack) -->
    <svg v-else viewBox="0 0 24 16" class="block h-full w-full" preserveAspectRatio="none">
      <rect width="24" height="16" fill="#012169" />
      <path d="M0 0 24 16M24 0 0 16" stroke="#fff" stroke-width="3.2" />
      <path d="M0 0 24 16M24 0 0 16" stroke="#C8102E" stroke-width="1.4" />
      <rect x="10" width="4" height="16" fill="#fff" />
      <rect y="6" width="24" height="4" fill="#fff" />
      <rect x="11" width="2" height="16" fill="#C8102E" />
      <rect y="7" width="24" height="2" fill="#C8102E" />
    </svg>
  </span>
</template>
