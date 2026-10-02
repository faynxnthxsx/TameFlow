<template>
  <div class="relative flex min-h-screen flex-col bg-bg">
    <NuxtLoadingIndicator color="var(--tf-color-primary)" :height="3" />
    <!-- soft brand wash in the background -->
    <div
      class="pointer-events-none absolute inset-0 opacity-80"
      style="background: radial-gradient(60rem 40rem at 110% -10%, color-mix(in srgb, var(--tf-color-brand-accent) 25%, transparent), transparent 60%), radial-gradient(50rem 40rem at -10% 110%, color-mix(in srgb, var(--tf-color-primary) 22%, transparent), transparent 60%);"
    />
    <header class="absolute inset-x-0 top-0 z-10 flex h-16 items-center px-6">
      <BrandLogo :with-text="true" size="md" />
    </header>
    <main class="relative z-10 flex min-h-screen items-center justify-center p-6">
      <slot />
    </main>
  </div>
</template>
