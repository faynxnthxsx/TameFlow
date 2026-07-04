<template>
  <div class="flex min-h-screen flex-col bg-bg">
    <LayoutAppNavbar />
    <div class="flex flex-1">
      <LayoutAppSidebar />
      <main class="flex-1 p-6">
        <slot />
      </main>
    </div>
  </div>
</template>
