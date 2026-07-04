export default defineNuxtPlugin(() => {
  const { initFromStorage } = useTheme()
  initFromStorage()
})
