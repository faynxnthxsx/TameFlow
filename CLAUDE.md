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

The project is built in phases, roughly one migration per phase: Phase 0 theming/i18n/layout/`user_profiles` (`20260703*`), Phase 1 auth, Phase 2 workspaces + membership, Phase 3 projects + tasks, Phase 4 invitations (the `20260704*` timestamps), then task checklists, task comments, and avatar storage (the `20260705*` timestamps), then Phase 6 team chat + company overview (`20260706*`). Data access is currently client-side via `useSupabaseClient()` guarded by RLS (see below); there are no `server/api/*` routes yet.

## Architecture

### Theming — the `--tf-*` token contract

`app/assets/css/themes/_variables.css` defines the full set of `--tf-*` CSS custom properties (surfaces, text, brand, semantic, priority tags, chrome, shadows, chart series). Each theme file in that folder must redefine **all** of them under a `[data-theme="..."]` selector. `tailwind.config.ts` maps every token to a Tailwind color/shadow (`bg-primary`, `text-text-muted`, `shadow-card`, ...).

`docs/design-reference.png` is the target visual design the UI is being built toward — consult it when implementing or restyling pages.

Components must only use these tokens (via the Tailwind mappings or `var(--tf-*)`) — never hardcoded colors. The app ships **one blue brand theme in two modes**: light (`corporate-blue`) and dark (`dark-mode`), toggled by `LayoutThemeSwitcher` / `useTheme().toggleTheme()`. The theme id is still the persisted value (localStorage `tf_theme` + `user_profiles.preferred_theme`). Adding/changing a mode requires coordinated changes: its CSS file imported in `main.css`, an entry in the `THEMES` registry in `app/composables/useTheme.ts`, and the `preferred_theme` check constraint in the DB (new migration — see `20260704160000_theme_light_dark.sql`).

### User preferences (theme + locale) share one persistence pattern

Priority: DB `user_profiles` row > localStorage > browser language (locale only) > default. Each has:
- a composable (`useTheme`, `useLocalePreference`) that sets + persists to localStorage (`tf_theme`, `tf_locale`)
- a client-only boot plugin (`app/plugins/theme-init.client.ts`, `locale-init.client.ts`) that applies the stored value on startup

`useI18n()` requires a component setup context, so the locale plugin drives `nuxtApp.$i18n` directly with the standalone `resolveStoredLocale()` helper instead of calling the composable.

The DB tier is applied by a third plugin, `app/plugins/profile-prefs.client.ts`: it `watch`es `useSupabaseUser()` and, once a session exists, fetches `preferred_theme`/`preferred_language` and overwrites the localStorage-derived values (this ordering is what makes "DB > localStorage" hold in practice). Profile identity (display name + avatar) is shared across components via the `useProfileState()` composable, a `useState('tf-profile')` singleton that pages like `profile.vue` mutate with `setProfile()` so the navbar/sidebar update immediately.

i18n: locales `en`/`th`/`ja`, `no_prefix` strategy, lazy-loaded JSON in `i18n/locales/`. Tailwind's `content` globs include `i18n/**/*.json`, so classes used in locale files are picked up.

### Supabase

- The module's built-in route protection is disabled (`redirectOptions.exclude: ['/**']` in `nuxt.config.ts`); guarding lives in `app/middleware/auth.global.ts`, which redirects unauthenticated users to `/login` except for `PUBLIC_PATHS` (`/login`, `/register`, `/confirm`). Don't "fix" the exclusion.
- Migrations follow conventions set in `20260703000000_init_user_profiles.sql`: RLS enabled on every table, the shared `public.touch_updated_at()` trigger keeps `updated_at` current on mutable tables, and `public.handle_new_user()` auto-creates a `user_profiles` row per new auth user.
- DB check constraints on `preferred_language`/`preferred_theme` must stay in sync with `SUPPORTED_LOCALES` and `THEMES` in the composables.
- `app/types/database.types.ts` is **hand-written** to match the migrations (the CLI isn't linked yet), and `useSupabaseClient<Database>()` is typed against it. Update it by hand whenever a migration changes a table's shape; once `supabase link` is set up, regenerate with `supabase gen types typescript --linked > app/types/database.types.ts` (command is in the file header).
- **Realtime** (Phase 6, team chat) is opt-in per table: the `20260706000000_team_chat.sql` migration adds `chat_messages` to the `supabase_realtime` publication inside a guarded `do $$` block (idempotent on re-run). The client side lives in `useChatStore` — `subscribe(workspaceId)` opens a `postgres_changes` channel filtered by `workspace_id` and refetches on INSERT; always pair it with `unsubscribe()` in `onBeforeUnmount`. To make a new table live, add it to the publication the same way.

### Data model & RLS (workspaces → projects → tasks)

Every table is scoped to a workspace and access is enforced entirely in Postgres RLS, keyed off `public.workspace_role(ws_id)` — a `stable security definer` SQL function returning the caller's role (or null). It's `security definer` specifically so policies can call it without recursing back into RLS on `workspace_members`. **Write new policies in terms of `workspace_role()`; don't reinvent membership joins inline.**

Two patterns recur and should be followed for new features:

- **RPC for atomic / privilege-crossing writes.** There is deliberately no INSERT policy on `workspaces`; creation goes through the `create_workspace()` RPC (called via `supabase.rpc(...)` in `app/stores/workspaces.ts`) so the workspace row and its owner `workspace_members` row are written in one transaction. Likewise invitations use `my_invitations()` / `accept_invitation()` / `decline_invitation()` — `security definer` so an invitee, who has no role in the workspace yet, can read the workspace name and insert their own membership. Match against the JWT email claim (`auth.jwt() ->> 'email'`), case-insensitively.
- **Denormalized `workspace_id` on `tasks`.** `tasks.workspace_id` is copied from the parent project by the `tasks_sync_workspace` BEFORE trigger (clients never send it) so task policies can call `workspace_role(workspace_id)` directly without a join. Preserve this when adding task-scoped tables.

The task RLS policies (`20260704120000_projects_tasks.sql`) intentionally mirror `resolveCapabilities()` in `app/utils/permissions.ts`: owner/admin edit & delete anything, members create and edit only their own tasks (`created_by = auth.uid()`), viewers read only. Changing one without the other creates a client/DB permission mismatch. The chat policies (`20260706000000_team_chat.sql`) do the same: send = anyone but a viewer (mirrors `!viewOnly`), set chat color = owner/admin (mirrors the `manageChat` capability). UI checks in `chat.vue` call `resolveCapabilities()`, so keep the capability, the RLS `with check`, and the UI guard in step.

### Cross-file invariants

Several enums are duplicated across TS and SQL and must be changed together:

- `WorkspaceRole` (`app/utils/permissions.ts`) ↔ `role` check constraints in the workspaces/members/invitations migrations (note invitations exclude `owner` — ownership is never transferred via invite).
- `TASK_STATUSES` / `TASK_PRIORITIES` (`app/utils/tasks.ts`) ↔ `status`/`priority` check constraints in `20260704120000_projects_tasks.sql`. Priority names also match the `--tf-color-priority-*` theme tokens.
- `TASK_TYPES` (`app/utils/tasks.ts`, values `dev`/`design`/`test`/`other`) ↔ the `type` check constraint added in `20260706120000_task_type.sql`. This column powers the "task type" donut on the `/overview` dashboard; it needed no new RLS policy since the existing task policies already gate every row.

### Pinia stores

Stores live in `app/stores/` (setup syntax, e.g. `useWorkspacesStore`) and are the seam between components and Supabase — they call `useSupabaseClient()` / `.rpc()` and expose typed camelCase view models (`WorkspaceSummary`) rather than raw PostgREST rows. Prefer adding data access here over querying Supabase directly in pages.

Cross-team read-only aggregation is done **client-side over existing RLS**, not with new tables or RPCs: `fetchOverview()` (backing the `/overview` company dashboard) does three bulk `.in('workspace_id', ids)` reads for members/projects/tasks and groups them in JS. RLS already scopes each read to the caller's workspaces, so no new policy is needed — follow this pattern for other roll-up/dashboard reads instead of denormalizing counts into the DB.

### Permissions

Workspace roles (`owner`/`admin`/`member`/`viewer`) map to capability sets in `app/utils/permissions.ts` (`resolveCapabilities`, `canEditTask`). UI permission checks should go through these helpers rather than comparing role strings inline.
