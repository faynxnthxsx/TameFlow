# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

Package manager is pnpm.

- `pnpm dev` — dev server at http://localhost:3000
- `pnpm build` — production build
- `pnpm test` — run all unit tests (vitest run)
- `pnpm vitest run tests/unit/dates.spec.ts` — run a single test file
- `pnpm supabase ...` — Supabase CLI (devDependency); migrations live in `supabase/migrations/`

Tests use a standalone `vitest.config.ts` (happy-dom, `globals: true`, `~`/`@` aliased to `./app`) — they do not boot Nuxt. Unit-testable logic therefore lives as pure framework-free functions in `app/utils/` (e.g. `permissions.ts`, `dates.ts`, `checklist.ts`), tested from `tests/unit/`.

## Stack

Nuxt 4 (`app/` directory structure) + Pinia + VueUse + `@nuxtjs/supabase` + `@nuxtjs/i18n` + Tailwind. Env vars in `.env` (see `.env.example`): `NUXT_PUBLIC_SUPABASE_URL`, `NUXT_PUBLIC_SUPABASE_KEY`, and `SUPABASE_SERVICE_ROLE_KEY` (server-only, for future `server/api/*` routes that bypass RLS).

The project is being built in phases. Phase 0 (current baseline) is theming, i18n, layout shell, and the `user_profiles` schema. `TODO(Phase 1 - Auth/Profile)` comments mark where auth wiring goes next.

## Architecture

### Theming — the `--tf-*` token contract

`app/assets/css/themes/_variables.css` defines the full set of `--tf-*` CSS custom properties (surfaces, text, brand, semantic, priority tags, chrome, shadows, chart series). Each theme file in that folder must redefine **all** of them under a `[data-theme="..."]` selector. `tailwind.config.ts` maps every token to a Tailwind color/shadow (`bg-primary`, `text-text-muted`, `shadow-card`, ...).

Components must only use these tokens (via the Tailwind mappings or `var(--tf-*)`) — never hardcoded colors. Adding a theme requires four coordinated changes: a new CSS file imported in `main.css`, an entry in the `THEMES` registry in `app/composables/useTheme.ts`, and updating the `preferred_theme` check constraint in the DB (new migration).

### User preferences (theme + locale) share one persistence pattern

Priority: DB `user_profiles` row (Phase 1, not yet wired) > localStorage > browser language (locale only) > default. Each has:
- a composable (`useTheme`, `useLocalePreference`) that sets + persists to localStorage (`tf_theme`, `tf_locale`)
- a client-only boot plugin (`app/plugins/theme-init.client.ts`, `locale-init.client.ts`) that applies the stored value on startup

`useI18n()` requires a component setup context, so the locale plugin drives `nuxtApp.$i18n` directly with the standalone `resolveStoredLocale()` helper instead of calling the composable.

i18n: locales `en`/`th`/`ja`, `no_prefix` strategy, lazy-loaded JSON in `i18n/locales/`. Tailwind's `content` globs include `i18n/**/*.json`, so classes used in locale files are picked up.

### Supabase

- The module's built-in route protection is disabled (`redirectOptions.exclude: ['/**']` in `nuxt.config.ts`) — auth guarding is intended to be a custom `app/middleware/auth.global.ts` (Phase 1, does not exist yet). Don't "fix" the exclusion.
- Migrations follow conventions set in `20260703000000_init_user_profiles.sql`: RLS enabled on every table, the shared `public.touch_updated_at()` trigger keeps `updated_at` current on mutable tables, and `public.handle_new_user()` auto-creates a `user_profiles` row per new auth user.
- DB check constraints on `preferred_language`/`preferred_theme` must stay in sync with `SUPPORTED_LOCALES` and `THEMES` in the composables.

### Permissions

Workspace roles (`owner`/`admin`/`member`/`viewer`) map to capability sets in `app/utils/permissions.ts` (`resolveCapabilities`, `canEditTask`). UI permission checks should go through these helpers rather than comparing role strings inline.
