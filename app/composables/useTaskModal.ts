export const useTaskModal = () => {
  const selectedTaskId = useState<string | null>('selectedTaskId', () => null)
  const refreshTrigger = useState<number>('taskModalRefresh', () => 0)
  return {
    selectedTaskId,
    refreshTrigger,
    open: (id: string) => { selectedTaskId.value = id },
    close: () => { selectedTaskId.value = null; refreshTrigger.value++ }
  }
}