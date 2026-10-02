<script setup lang="ts">
const taskModal = useTaskModal()
</script>

<template>
  <div>
    <NuxtRouteAnnouncer />
    <NuxtLayout>
      <NuxtPage />
    </NuxtLayout>

    <Teleport to="body">
      <div v-if="taskModal.selectedTaskId.value" class="fixed inset-0 z-[100] flex justify-end">
        <div class="absolute inset-0 bg-text/50 backdrop-blur-sm" @click="taskModal.close()" />
        <div class="relative w-full max-w-2xl bg-surface h-full overflow-y-auto shadow-modal flex flex-col pt-6 px-4 pb-6">
          <TaskDetail :task-id="taskModal.selectedTaskId.value" @close="taskModal.close()" />
        </div>
      </div>
    </Teleport>
  </div>
</template>
