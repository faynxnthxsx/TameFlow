import { ref } from 'vue'

export type ToastType = 'success' | 'error' | 'info'
export interface Toast {
  id: string
  message: string
  type: ToastType
}

const toasts = ref<Toast[]>([])

export function useToast() {
  const add = (message: string, type: ToastType = 'info', duration = 3000) => {
    const id = Math.random().toString(36).substring(2)
    toasts.value.push({ id, message, type })
    setTimeout(() => remove(id), duration)
  }

  const remove = (id: string) => {
    toasts.value = toasts.value.filter(t => t.id !== id)
  }

  return {
    toasts,
    add,
    remove,
    success: (msg: string, dur?: number) => add(msg, 'success', dur),
    error: (msg: string, dur?: number) => add(msg, 'error', dur),
    info: (msg: string, dur?: number) => add(msg, 'info', dur)
  }
}
