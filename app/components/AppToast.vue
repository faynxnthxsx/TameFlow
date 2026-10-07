<script setup lang="ts">
const { toasts, remove } = useToast()
</script>

<template>
  <Teleport to="body">
    <div class="pointer-events-none fixed bottom-4 right-4 z-[9999] flex flex-col gap-2">
      <TransitionGroup name="toast">
        <div
          v-for="toast in toasts"
          :key="toast.id"
          class="pointer-events-auto flex items-center gap-3 rounded-lg px-4 py-3 shadow-lg backdrop-blur-md"
          :class="{
            'bg-success/10 text-success border border-success/20': toast.type === 'success',
            'bg-danger/10 text-danger border border-danger/20': toast.type === 'error',
            'bg-info/10 text-info border border-info/20': toast.type === 'info'
          }"
        >
          <AppIcon
            :name="toast.type === 'success' ? 'check' : toast.type === 'error' ? 'trash' : 'info'"
            class="h-5 w-5 shrink-0"
          />
          <span class="text-sm font-medium">{{ toast.message }}</span>
          <button @click="remove(toast.id)" class="ml-2 rounded p-1 opacity-70 transition hover:bg-black/5 hover:opacity-100">
            <AppIcon name="x" class="h-4 w-4" />
          </button>
        </div>
      </TransitionGroup>
    </div>
  </Teleport>
</template>

<style scoped>
.toast-move,
.toast-enter-active,
.toast-leave-active {
  transition: all 0.3s ease;
}

.toast-enter-from {
  opacity: 0;
  transform: translateX(30px);
}

.toast-leave-to {
  opacity: 0;
  transform: scale(0.9);
}
</style>
