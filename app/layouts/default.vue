<template>
  <div class="flex h-[100dvh] overflow-hidden bg-bg">
    <LayoutAppSidebar />
    <div class="flex min-w-0 flex-1 flex-col">
      <LayoutAppNavbar />
      <main class="flex-1 overflow-y-auto overflow-x-hidden p-4 sm:p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
