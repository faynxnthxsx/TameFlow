<script setup lang="ts">
// Framework-free calendar popover replacing the un-themeable native
// <input type="date">. Emits an ISO 'YYYY-MM-DD' string (or '' when cleared),
// built from local date parts so it never drifts across timezones.
//
// The picked day is held in a local `draft` and only committed when the user
// presses Confirm — so they can browse months and change days freely first.
// The panel flips above the trigger when there isn't room below (keeps the
// last week from being clipped by the viewport, e.g. on laptops).
const props = withDefaults(
  defineProps<{ modelValue: string; placeholder?: string }>(),
  { placeholder: '' }
)
const emit = defineEmits<{ 'update:modelValue': [string] }>()

const { t, locale } = useI18n()

const open = ref(false)
const dropUp = ref(false)
const root = ref<HTMLElement | null>(null)
onClickOutside(root, () => (open.value = false)) // outside click discards the draft

function toIso(d: Date) {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, '0')
  const day = String(d.getDate()).padStart(2, '0')
  return `${y}-${m}-${day}`
}
function fromIso(s: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s)
  return m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : null
}
function startOfMonth(d: Date) {
  return new Date(d.getFullYear(), d.getMonth(), 1)
}

const today = new Date()
const todayIso = toIso(today)

// Committed value → the label shown on the closed trigger.
const committed = computed(() => fromIso(props.modelValue))
const displayLabel = computed(() =>
  committed.value
    ? committed.value.toLocaleDateString(locale.value, { dateStyle: 'medium' })
    : ''
)

// Draft (uncommitted) selection + the month currently on screen.
const draft = ref(props.modelValue)
const view = ref(startOfMonth(fromIso(props.modelValue) ?? today))

watch(open, (isOpen) => {
  if (!isOpen) return
  // Open with a default selection: the committed value, or today when empty...
  draft.value = props.modelValue || todayIso
  view.value = startOfMonth(fromIso(draft.value) ?? today)
  // ...then decide whether to drop up or down based on available room.
  nextTick(() => {
    const rect = root.value?.getBoundingClientRect()
    if (!rect) return
    const PANEL = 380
    dropUp.value = window.innerHeight - rect.bottom < PANEL && rect.top > PANEL
  })
})

const monthLabel = computed(() =>
  view.value.toLocaleDateString(locale.value, { month: 'long', year: 'numeric' })
)

// Sunday-first short weekday headers, localized via Intl (2024-01-07 is a Sunday).
const weekdays = computed(() =>
  Array.from({ length: 7 }, (_, i) =>
    new Date(2024, 0, 7 + i).toLocaleDateString(locale.value, { weekday: 'short' }).slice(0, 2)
  )
)

// Calendar cells: leading blanks to align the 1st under its weekday, every day
// of the month, then trailing blanks to complete the final week row.
const cells = computed(() => {
  const first = view.value
  const offset = first.getDay() // 0 = Sunday
  const daysInMonth = new Date(first.getFullYear(), first.getMonth() + 1, 0).getDate()
  const out: (Date | null)[] = Array.from({ length: offset }, () => null)
  for (let d = 1; d <= daysInMonth; d++) {
    out.push(new Date(first.getFullYear(), first.getMonth(), d))
  }
  while (out.length % 7 !== 0) out.push(null)
  return out
})

function shiftMonth(delta: number) {
  view.value = new Date(view.value.getFullYear(), view.value.getMonth() + delta, 1)
}
function selectDay(d: Date) {
  draft.value = toIso(d) // stage only — no commit, panel stays open
}
function confirm() {
  emit('update:modelValue', draft.value)
  open.value = false
}
function clearField() {
  emit('update:modelValue', '')
  open.value = false
}
</script>

<template>
  <div ref="root" class="relative">
    <div
      class="flex w-full items-center gap-2 rounded-xl border border-border bg-surface px-3.5 py-2.5 text-sm text-text transition hover:border-primary/60"
      :class="{ 'border-primary ring-2 ring-primary/20': open }"
    >
      <button
        type="button"
        class="flex min-w-0 flex-1 items-center gap-2 text-left focus:outline-none"
        @click="open = !open"
      >
        <AppIcon name="calendar" class="h-4 w-4 shrink-0 text-text-muted" />
        <span class="min-w-0 flex-1 truncate" :class="{ 'text-text-muted': !displayLabel }">
          {{ displayLabel || placeholder }}
        </span>
      </button>
      <button
        v-if="displayLabel"
        type="button"
        class="shrink-0 rounded p-0.5 text-text-muted transition hover:text-danger"
        :aria-label="t('common.clear')"
        @click.stop="clearField"
      >
        <AppIcon name="x" class="h-3.5 w-3.5" />
      </button>
    </div>

    <Transition
      enter-active-class="transition duration-100 ease-out"
      enter-from-class="-translate-y-1 opacity-0"
      leave-active-class="transition duration-75 ease-in"
      leave-to-class="-translate-y-1 opacity-0"
    >
      <div
        v-if="open"
        class="absolute z-20 w-72 rounded-2xl border border-border bg-surface p-3 shadow-modal"
        :class="dropUp ? 'bottom-full mb-1.5' : 'top-full mt-1.5'"
      >
        <!-- Month header -->
        <div class="flex items-center justify-between px-1">
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-lg text-text-muted transition hover:bg-surface-alt hover:text-text"
            @click="shiftMonth(-1)"
          >
            <AppIcon name="chevron-left" class="h-4 w-4" />
          </button>
          <span class="text-sm font-semibold capitalize text-text">{{ monthLabel }}</span>
          <button
            type="button"
            class="grid h-8 w-8 place-items-center rounded-lg text-text-muted transition hover:bg-surface-alt hover:text-text"
            @click="shiftMonth(1)"
          >
            <AppIcon name="chevron-right" class="h-4 w-4" />
          </button>
        </div>

        <!-- Weekday row -->
        <div class="mt-2 grid grid-cols-7 gap-1">
          <span
            v-for="(w, i) in weekdays"
            :key="i"
            class="grid h-7 place-items-center text-xs font-medium text-text-muted"
          >
            {{ w }}
          </span>
        </div>

        <!-- Days -->
        <div class="grid grid-cols-7 gap-1">
          <template v-for="(cell, i) in cells" :key="i">
            <span v-if="!cell" class="h-9" />
            <button
              v-else
              type="button"
              class="grid h-9 place-items-center rounded-lg text-sm transition"
              :class="[
                toIso(cell) === draft
                  ? 'bg-primary font-semibold text-primary-fg'
                  : 'text-text hover:bg-surface-alt',
                toIso(cell) === todayIso && toIso(cell) !== draft
                  ? 'font-semibold text-primary ring-1 ring-inset ring-primary/40'
                  : ''
              ]"
              @click="selectDay(cell)"
            >
              {{ cell.getDate() }}
            </button>
          </template>
        </div>

        <!-- Footer: dismiss / commit -->
        <div class="mt-3 flex items-center justify-end gap-1.5 border-t border-border pt-3">
          <button
            type="button"
            class="rounded-lg px-2.5 py-1.5 text-xs font-medium text-text-muted transition hover:text-text"
            @click="open = false"
          >
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="rounded-lg bg-primary px-3 py-1.5 text-xs font-semibold text-primary-fg transition hover:bg-primary-hover"
            @click="confirm"
          >
            {{ t('common.confirm') }}
          </button>
        </div>
      </div>
    </Transition>
  </div>
</template>
