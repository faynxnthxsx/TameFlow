<script setup lang="ts">
const route = useRoute()
const router = useRouter()

const taskId = route.params.id as string

function handleClose() {
  if (router.options.history.state.back) {
    router.back()
  } else {
    navigateTo('/')
  }
}
</script>

<template>
  <div class="mx-auto max-w-3xl py-6">
    <TaskDetail :task-id="taskId" @close="handleClose" />
  </div>
</template>
