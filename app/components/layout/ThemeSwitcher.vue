<script setup lang="ts">
//หยิบของ 4 อย่างมาใช้ เพื่อจัดการธีมของระบบ
const { theme, THEMES, isDark, setTheme } = useTheme()
const { t } = useI18n()
</script>

<!-- สร้างกล่องสลับธีม เเละมีป้ายชื่อเลื่อนตามที่เลือก -->
<template>
  <div
    class="relative grid grid-cols-2 rounded-full border border-border/60 bg-surface-alt/80 p-0.5 text-xs font-medium"
  >
    <!-- สไลด์ซ้ายขวาครึ่งหนึ่ง -->
    <span
      class="pointer-events-none absolute bottom-0.5 top-0.5 w-[calc(50%-0.125rem)] rounded-full bg-surface shadow-sm transition-[left] duration-200 ease-out"
      :style="isDark ? 'left: 50%' : 'left: 0.125rem'"
    />
    <!-- ปุ่มสลับธีม ดึงธีมที่รองรับมาจาก THEMES เเละเเสดงผล -->
    <button
      v-for="item in THEMES"
      :key="item.id"
      type="button"
      class="relative z-10 rounded-full px-2.5 py-0.5 text-center transition-colors"
      :class="theme === item.id ? 'text-text' : 'text-text-muted hover:text-text'"
      @click="setTheme(item.id)"
    >
      {{ t(item.labelKey) }}
    </button>
  </div>
</template>
