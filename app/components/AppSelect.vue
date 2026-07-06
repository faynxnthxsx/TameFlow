<script setup lang="ts">
// Framework-free styled dropdown to replace the native <select> (which can't
// be themed). Keyboard-friendly, closes on outside-click / Esc, and renders
// its panel in-flow so it inherits the surrounding modal's stacking context.
interface Option {
  value: string
  label: string
}

const props = withDefaults(
  defineProps<{
    modelValue: string
    options: Option[]
    placeholder?: string
    icon?: string
  }>(),
  { placeholder: '', icon: '' }
)
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const open = ref(false)
const root = ref<HTMLElement | null>(null)

const selected = computed(() =>
  props.options.find((o) => o.value === props.modelValue)
)

onClickOutside(root, () => (open.value = false))

function toggle() {
  open.value = !open.value
}

function choose(value: string) {
  emit('update:modelValue', value)
  open.value = false
}
</script>

<template>
  <div ref="root" class="relative">
    <button
      type="button"
      class="flex w-full items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-left text-sm text-text transition hover:border-primary/60 focus:border-primary focus:outline-none focus:ring-2 focus:ring-primary/20"
      :class="{ 'border-primary ring-2 ring-primary/20': open }"
      @click="toggle"
    >
      <AppIcon v-if="icon" :name="icon" class="h-4 w-4 shrink-0 text-text-muted" />
      <span class="min-w-0 flex-1 truncate" :class="{ 'text-text-muted': !selected }">
        {{ selected ? selected.label : placeholder }}
      </span>
      <AppIcon
        name="chevron-down"
        class="h-4 w-4 shrink-0 text-text-muted transition"
        :class="{ 'rotate-180': open }"
      />
    </button>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="-translate-y-1 opacity-0"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <ul
        v-if="open"
        class="absolute z-20 mt-1.5 max-h-60 w-full overflow-auto rounded-xl border border-border bg-surface p-1 shadow-modal"
      >
        <li v-for="opt in options" :key="opt.value">
          <button
            type="button"
            class="flex w-full items-center justify-between gap-2 rounded-lg px-3 py-2 text-left text-sm transition"
            :class="opt.value === modelValue
              ? 'bg-primary/10 font-medium text-primary'
              : 'text-text hover:bg-surface-alt'"
            @click="choose(opt.value)"
          >
            <span class="truncate">{{ opt.label }}</span>
            <AppIcon
              v-if="opt.value === modelValue"
              name="check"
              class="h-4 w-4 shrink-0"
            />
          </button>
        </li>
      </ul>
    </Transition>
  </div>
</template>
